// 婚房单件衣物特写：保留实际衣柜作虚焦背景，不操作公共镜头或界面。
export function outfitDetail(h, original) {
  if (!original) return null;
  const T = h.THREE, root = new T.Group(); root.visible = false; root.renderOrder = 10000;
  original.updateWorldMatrix(true, true);
  const center = new T.Box3().setFromObject(original).getCenter(new T.Vector3());
  const copy = original.clone(true), owned = [];
  new T.Matrix4().makeTranslation(4.53, 5.22, -4.77)
    .multiply(new T.Matrix4().makeRotationY(-Math.PI / 2))
    .multiply(new T.Matrix4().makeScale(1.12, 1.12, 1.12))
    .multiply(new T.Matrix4().makeTranslation(-center.x, -center.y, -center.z))
    .multiply(original.matrixWorld).decompose(copy.position, copy.quaternion, copy.scale);
  copy.traverse(o => {
    if (o.isGroup) o.renderOrder = 10000;
    if (!o.isMesh) return;
    const clone = m => { const c = m.clone(); c.depthTest = c.depthWrite = false; c.transparent = true; owned.push(c); return c; };
    o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
    o.renderOrder = 10001; o.frustumCulled = false;
  });
  let picture = null;
  const mat = new T.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { picture: { value: null }, texel: { value: new T.Vector2(1/768, 1/432) } },
    vertexShader: 'varying vec2 uvScreen; void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader: `uniform sampler2D picture; uniform vec2 texel; varying vec2 uvScreen;
      void main(){vec4 sum=vec4(0.0);float total=0.0;
        for(int x=-4;x<=4;x++)for(int y=-4;y<=4;y++){
          float w=exp(-float(x*x+y*y)/12.0);sum+=texture2D(picture,uvScreen+vec2(float(x),float(y))*texel*2.0)*w;total+=w;
        }gl_FragColor=vec4(sum.rgb/total,1.0);

      }` });
  const screen = new T.Mesh(new T.PlaneGeometry(2,2), mat); screen.frustumCulled = false; screen.renderOrder = 10000;
  let captured = false;
  const cameraPosition = new T.Vector3(), cameraRotation = new T.Quaternion();
  screen.onBeforeRender = (renderer, scene, camera) => {
    if (renderer.getRenderTarget() !== null) return;
    // 下一拍开始转头或移动时，特写自动收起；看词卡时可一直停留。
    if (captured && (camera.position.distanceToSquared(cameraPosition) > .0009 || camera.quaternion.angleTo(cameraRotation) > .05)) {
      root.visible = false; return;
    }
    const size = renderer.getDrawingBufferSize(new T.Vector2());
    if (captured && picture.image.width === size.x && picture.image.height === size.y) return;
    // 直接复用当前帧已画好的衣柜，不再额外渲染整屋，避免递归渲染和额外负担。
    if (!picture || picture.image.width !== size.x || picture.image.height !== size.y) {
      picture?.dispose(); picture = new T.FramebufferTexture(size.x, size.y);
      // 帧缓冲已是屏幕颜色；按原字节采样，避免 sRGB 内部格式复制失效。
      picture.colorSpace = T.NoColorSpace;
      picture.minFilter = picture.magFilter = T.LinearFilter;
      mat.uniforms.picture.value = picture;
    }
    mat.uniforms.texel.value.set(2/size.x, 2/size.y);
    renderer.copyFramebufferToTexture(new T.Vector2(0,0), picture);
    cameraPosition.copy(camera.position); cameraRotation.copy(camera.quaternion); captured = true;
  };
  root.add(screen,copy); h.scene.add(root);
  return {
    show() { captured = false; root.visible = true; },
    hide() { root.visible = false; },
    dispose() { root.removeFromParent(); picture?.dispose(); screen.geometry.dispose(); mat.dispose(); owned.forEach(m=>m.dispose()); },
  };
}
