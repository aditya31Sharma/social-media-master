import * as THREE from 'three';
const GLASS = Object.freeze({ x: 20 / 390, y: .4 - 20 / (390 * 16 / 9), w: 350 / 390, h: .6, radius: 48 / 390 });

// Rounded lens: refract the backdrop at its rim, then add scattering and highlights.
// Uses the gallery's renderer so preview and MP4 contain the same optical treatment.
export function createLiquidGlass(renderer, source) {
  const texture = new THREE.CanvasTexture(source); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.ShaderMaterial({
    uniforms: { backdrop: { value: texture }, amount: { value: 0 },
      rect: { value: new THREE.Vector4(GLASS.x * 1080, GLASS.y * 1920, GLASS.w * 1080, GLASS.h * 1920) },
      radius: { value: GLASS.radius * 1080 } },
    vertexShader: 'varying vec2 uvGlass; void main(){ uvGlass = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `
      uniform sampler2D backdrop; uniform vec4 rect; uniform float radius; uniform float amount;
      varying vec2 uvGlass;
      vec2 size = vec2(1080., 1920.);
      float distanceToGlass(vec2 p, vec2 center) {
        vec2 q = abs(p - center) - rect.zw * .5 + radius;
        return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - radius;
      }
      vec3 readBackdrop(vec2 p) { return texture2D(backdrop, clamp(vec2(p.x / size.x, 1. - p.y / size.y), .001, .999)).rgb; }
      void main() {
        vec2 p = vec2(uvGlass.x, 1. - uvGlass.y) * size;
        vec2 center = rect.xy + rect.zw * .5 + vec2(0., (1. - amount) * 140.);
        float d = distanceToGlass(p, center);
        vec3 base = readBackdrop(p);
        float shadow = exp(-max(d, 0.) / 22.) * .24 * amount;
        base *= 1. - shadow * smoothstep(-1., 2., d);
        if (d < 1.) {
          vec2 normal = normalize(vec2(distanceToGlass(p + vec2(1.,0.), center) - distanceToGlass(p - vec2(1.,0.), center),
            distanceToGlass(p + vec2(0.,1.), center) - distanceToGlass(p - vec2(0.,1.), center)) + vec2(.0001));
          float rim = 1. - smoothstep(0., 65., -d);
          vec2 lens = p - normal * sin(rim * 1.5708) * 28. * amount;
          vec3 refracted = readBackdrop(lens) * .4;
          refracted += (readBackdrop(lens + vec2(10.,0.)) + readBackdrop(lens - vec2(10.,0.))
            + readBackdrop(lens + vec2(0.,10.)) + readBackdrop(lens - vec2(0.,10.))) * .15;
          float highlight = pow(max(0., dot(normal, normalize(vec2(-.6,-.8)))), 3.) * pow(rim, 8.);
          vec3 glass = refracted * .82 + vec3(.085) + highlight * .42;
          glass += vec3(.2) * exp(-abs(d + 2.) / 1.4);
          base = mix(base, glass, (1. - smoothstep(-1.,1.,d)) * amount);
        }
        gl_FragColor = vec4(base, 1.);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2), scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material)); const camera = new THREE.Camera();
  return {
    render(amount) { material.uniforms.amount.value = amount; texture.needsUpdate = true; renderer.render(scene, camera); return renderer.domElement; },
    dispose() { texture.dispose(); material.dispose(); geometry.dispose(); },
  };
}
