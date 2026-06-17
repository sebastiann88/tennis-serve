import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ── Renderer ────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.autoUpdate = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// ── Camera ──────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  45, window.innerWidth / window.innerHeight, 0.1, 500
);
const baselineZ = 23.77 / 2;
const playerX = 1.0;
camera.position.set(playerX + 0.8, 1.7, baselineZ + 3.8);
camera.lookAt(playerX, 0.9, baselineZ);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minDistance = 2;
controls.maxDistance = 40;
controls.target.set(playerX, 0.9, baselineZ);

// ── Post-processing ────────────────────────────────────────
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Bloom — gorgeous glow on lights and emissive surfaces
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.15,  // strength
  0.4,   // radius
  0.85   // threshold
);
composer.addPass(bloomPass);

// Color grading — warm cinematic golden-hour look
const colorGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    warmth: { value: 0.02 },
    contrast: { value: 1.02 },
    saturation: { value: 1.04 },
    vignette: { value: 0.25 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float warmth;
    uniform float contrast;
    uniform float saturation;
    uniform float vignette;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Warmth shift
      color.r += warmth;
      color.g += warmth * 0.4;
      color.b -= warmth * 0.3;

      // Contrast
      color.rgb = (color.rgb - 0.5) * contrast + 0.5;

      // Saturation
      float grey = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(grey), color.rgb, saturation);

      // Vignette
      vec2 uv = vUv * (1.0 - vUv);
      float vig = uv.x * uv.y * 15.0;
      vig = pow(vig, vignette);
      color.rgb *= vig;

      gl_FragColor = color;
    }
  `,
};
const colorPass = new ShaderPass(colorGradingShader);
composer.addPass(colorPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// ── Texture helpers ─────────────────────────────────────────
function makeCanvasTexture(width, height, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Court surface texture (hard-court with subtle grain) ────
function createCourtTexture() {
  return makeCanvasTexture(2048, 2048, (ctx, w, h) => {
    ctx.fillStyle = '#1a5276';
    ctx.fillRect(0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 18;
      imgData.data[i] += noise;
      imgData.data[i + 1] += noise;
      imgData.data[i + 2] += noise;
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;

    const margin = 100;
    const courtL = margin;
    const courtR = w - margin;
    const courtT = margin;
    const courtB = h - margin;
    const courtW = courtR - courtL;
    const courtH = courtB - courtT;

    ctx.strokeRect(courtL, courtT, courtW, courtH);

    const singlesInset = courtW * (1.37 / 10.97);
    ctx.beginPath();
    ctx.moveTo(courtL + singlesInset, courtT);
    ctx.lineTo(courtL + singlesInset, courtB);
    ctx.moveTo(courtR - singlesInset, courtT);
    ctx.lineTo(courtR - singlesInset, courtB);
    ctx.stroke();

    const centerY = courtT + courtH / 2;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(courtL, centerY);
    ctx.lineTo(courtR, centerY);
    ctx.stroke();

    ctx.lineWidth = 8;
    const serviceDepth = courtH * (6.4 / 23.77);
    ctx.beginPath();
    ctx.moveTo(courtL + singlesInset, centerY - serviceDepth);
    ctx.lineTo(courtR - singlesInset, centerY - serviceDepth);
    ctx.moveTo(courtL + singlesInset, centerY + serviceDepth);
    ctx.lineTo(courtR - singlesInset, centerY + serviceDepth);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(courtL + courtW / 2, centerY - serviceDepth);
    ctx.lineTo(courtL + courtW / 2, centerY + serviceDepth);
    ctx.stroke();

    ctx.lineWidth = 8;
    const markLen = courtH * (0.1 / 23.77) * 5;
    ctx.beginPath();
    ctx.moveTo(courtL + courtW / 2, courtT);
    ctx.lineTo(courtL + courtW / 2, courtT + markLen);
    ctx.moveTo(courtL + courtW / 2, courtB);
    ctx.lineTo(courtL + courtW / 2, courtB - markLen);
    ctx.stroke();
  });
}

// ── Court normal map (surface texture detail) ───────────────
function createCourtNormalMap() {
  return makeCanvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 30;
      imgData.data[i] = 128 + n;
      imgData.data[i + 1] = 128 + n;
      imgData.data[i + 2] = 255;
      imgData.data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  });
}

// ── Surrounding area texture ────────────────────────────────
function createSurroundTexture() {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1a3c28';
    ctx.fillRect(0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 12;
      imgData.data[i] += n;
      imgData.data[i + 1] += n;
      imgData.data[i + 2] += n;
    }
    ctx.putImageData(imgData, 0, 0);
  });
}

// ── Build the court ─────────────────────────────────────────
const courtTex = createCourtTexture();
const courtNormal = createCourtNormalMap();
const courtWidth = 10.97;
const courtLength = 23.77;

const courtGeo = new THREE.PlaneGeometry(courtWidth, courtLength);
const courtMat = new THREE.MeshStandardMaterial({
  map: courtTex,
  normalMap: courtNormal,
  normalScale: new THREE.Vector2(0.15, 0.15),
  roughness: 0.85,
  metalness: 0.0,
});
const courtMesh = new THREE.Mesh(courtGeo, courtMat);
courtMesh.rotation.x = -Math.PI / 2;
courtMesh.receiveShadow = true;
scene.add(courtMesh);

// Surrounding ground
const surroundTex = createSurroundTexture();
surroundTex.wrapS = surroundTex.wrapT = THREE.RepeatWrapping;
surroundTex.repeat.set(8, 8);
const groundGeo = new THREE.PlaneGeometry(80, 80);
const groundMat = new THREE.MeshStandardMaterial({
  map: surroundTex,
  roughness: 0.9,
  metalness: 0.0,
});
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.position.y = -0.01;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// ── Net ─────────────────────────────────────────────────────
function buildNet() {
  const group = new THREE.Group();
  const netHeight = 1.07;
  const netCenterHeight = 0.914;
  const netWidth = courtWidth + 0.914 * 2;

  const postGeo = new THREE.CylinderGeometry(0.04, 0.04, netHeight + 0.15, 8);
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x333333, roughness: 0.3, metalness: 0.8,
  });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(side * netWidth / 2, (netHeight + 0.15) / 2, 0);
    post.castShadow = true;
    group.add(post);
  }

  const netTex = makeCanvasTexture(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    const spacing = 6;
    for (let x = 0; x < w; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  });
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;

  const netGeo = new THREE.PlaneGeometry(netWidth, netHeight, 32, 1);
  const posAttr = netGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const normalizedX = Math.abs(x) / (netWidth / 2);
    const sag = (1 - normalizedX * normalizedX) * (netHeight - netCenterHeight);
    posAttr.setY(i, posAttr.getY(i) - sag * 0.5);
  }
  posAttr.needsUpdate = true;
  netGeo.computeVertexNormals();

  const netMat = new THREE.MeshStandardMaterial({
    map: netTex, transparent: true, opacity: 0.7,
    side: THREE.DoubleSide, roughness: 0.9, metalness: 0.1, color: 0xeeeeee,
  });
  const netMesh = new THREE.Mesh(netGeo, netMat);
  netMesh.position.y = netHeight / 2 + 0.05;
  netMesh.castShadow = true;
  group.add(netMesh);

  const bandGeo = new THREE.BoxGeometry(netWidth, 0.06, 0.02);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.position.y = netHeight + 0.03;
  group.add(band);

  return group;
}
const net = buildNet();
scene.add(net);

// ── Stadium lights (4 tall poles with warm spotlights) ──────
function createFloodlight(x, z, targetX, targetZ) {
  const group = new THREE.Group();
  const poleH = 14;

  const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, poleH, 6);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x555555, roughness: 0.4, metalness: 0.7,
  });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(x, poleH / 2, z);
  pole.castShadow = true;
  group.add(pole);

  const housingGeo = new THREE.BoxGeometry(1.5, 0.4, 0.8);
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x444444, roughness: 0.3, metalness: 0.6,
  });
  const housing = new THREE.Mesh(housingGeo, housingMat);
  housing.position.set(x, poleH + 0.2, z);
  group.add(housing);

  // Emissive panel (glowing face — bloom picks this up)
  const panelGeo = new THREE.PlaneGeometry(1.4, 0.35);
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0xfff4e0,
    emissive: 0xffd699,
    emissiveIntensity: 2.5,
  });
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.position.set(x, poleH, z);
  panel.rotation.x = -Math.PI / 2 + 0.4;
  group.add(panel);

  // Light glow sprite (soft halo around each light)
  const glowTex = makeCanvasTexture(128, 128, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, 'rgba(255, 220, 150, 0.6)');
    gradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, opacity: 0.8,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.position.set(x, poleH + 0.1, z);
  glow.scale.set(5, 5, 1);
  group.add(glow);

  // Spotlight
  const spotLight = new THREE.SpotLight(0xffeacc, 120, 60, Math.PI / 5, 0.5, 1.2);
  spotLight.position.set(x, poleH, z);
  spotLight.target.position.set(targetX, 0, targetZ);
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.set(1024, 1024);
  spotLight.shadow.bias = -0.001;
  group.add(spotLight);
  group.add(spotLight.target);

  // Volumetric light cone (subtle visible beam)
  const coneH = 14;
  const coneR = 6;
  const coneGeo = new THREE.ConeGeometry(coneR, coneH, 32, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffeedd,
    transparent: true,
    opacity: 0.02,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(x, poleH - coneH / 2, z);
  group.add(cone);

  return group;
}

const lightPositions = [
  { x: -12, z: -10, tx: 2, tz: 0 },
  { x: 12, z: -10, tx: -2, tz: 0 },
  { x: -12, z: 10, tx: 2, tz: 0 },
  { x: 12, z: 10, tx: -2, tz: 0 },
];
for (const lp of lightPositions) {
  scene.add(createFloodlight(lp.x, lp.z, lp.tx, lp.tz));
}

// ── Sunset sky (EXR HDR) ────────────────────────────────────
new EXRLoader().load('images/sunset.exr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;
  scene.environmentIntensity = 0.4;
});

// Warm ambient fill
const ambientLight = new THREE.AmbientLight(0x886655, 0.8);
scene.add(ambientLight);

// Hemisphere: warm sky above, cool ground reflection
const hemiLight = new THREE.HemisphereLight(0xffaa66, 0x334455, 0.6);
scene.add(hemiLight);

// Sun – low on the horizon, warm golden-hour light
const sunLight = new THREE.DirectionalLight(0xffcc77, 1.8);
sunLight.position.set(-15, 6, -20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -25;
sunLight.shadow.camera.right = 25;
sunLight.shadow.camera.top = 25;
sunLight.shadow.camera.bottom = -25;
sunLight.shadow.bias = -0.001;
scene.add(sunLight);

// Secondary fill from the opposite side (sky bounce)
const fillLight = new THREE.DirectionalLight(0x8899cc, 0.4);
fillLight.position.set(10, 12, 15);
scene.add(fillLight);

// Rim light — catches the model edges for a cinematic silhouette
const rimLight = new THREE.DirectionalLight(0xffaa55, 0.5);
rimLight.position.set(-8, 4, -15);
scene.add(rimLight);

// ── Fence / boundary (chain-link pattern) ───────────────────
function createChainLinkTexture() {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(180, 180, 180, 0.7)';
    ctx.lineWidth = 1.5;
    const spacing = 12;
    // Diamond chain-link pattern
    for (let y = -h; y < h * 2; y += spacing) {
      ctx.beginPath();
      for (let x = 0; x < w; x += 2) {
        const yOff = Math.abs((x % (spacing * 2)) - spacing) - spacing / 2;
        ctx.lineTo(x, y + yOff);
      }
      ctx.stroke();
    }
    // Horizontal wire accents
    ctx.strokeStyle = 'rgba(160, 160, 160, 0.3)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += spacing * 2) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });
}

function createFence() {
  const group = new THREE.Group();
  const fenceH = 3;
  const fenceDistance = 24;
  const postSpacing = 4;
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x4a4a4a, roughness: 0.35, metalness: 0.8,
  });

  const chainTex = createChainLinkTexture();
  chainTex.wrapS = chainTex.wrapT = THREE.RepeatWrapping;

  const wireMat = new THREE.MeshStandardMaterial({
    map: chainTex,
    color: 0x777777,
    transparent: true,
    opacity: 0.5,
    roughness: 0.5,
    metalness: 0.6,
    side: THREE.DoubleSide,
  });

  // Top rail material
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x4a4a4a, roughness: 0.35, metalness: 0.8,
  });

  for (const side of [-1, 1]) {
    const x = side * fenceDistance;
    for (let z = -22; z <= 22; z += postSpacing) {
      const postGeo = new THREE.CylinderGeometry(0.04, 0.04, fenceH, 6);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, fenceH / 2, z);
      post.castShadow = true;
      group.add(post);
    }
    // Chain-link panel
    const sideTex = chainTex.clone();
    sideTex.repeat.set(12, 2);
    const sideWireMat = wireMat.clone();
    sideWireMat.map = sideTex;
    const planeGeo = new THREE.PlaneGeometry(44, fenceH);
    const plane = new THREE.Mesh(planeGeo, sideWireMat);
    plane.position.set(x, fenceH / 2, 0);
    plane.rotation.y = Math.PI / 2;
    group.add(plane);

    // Top rail
    const railGeo = new THREE.CylinderGeometry(0.025, 0.025, 44, 6);
    railGeo.rotateX(Math.PI / 2);
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(x, fenceH, 0);
    group.add(rail);
  }

  // Back fence
  for (let x = -fenceDistance; x <= fenceDistance; x += postSpacing) {
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, fenceH, 6);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, fenceH / 2, -22);
    post.castShadow = true;
    group.add(post);
  }
  const backTex = chainTex.clone();
  backTex.repeat.set(14, 2);
  const backWireMat = wireMat.clone();
  backWireMat.map = backTex;
  const backPlane = new THREE.PlaneGeometry(fenceDistance * 2, fenceH);
  const backMesh = new THREE.Mesh(backPlane, backWireMat);
  backMesh.position.set(0, fenceH / 2, -22);
  group.add(backMesh);

  // Back top rail
  const backRailGeo = new THREE.CylinderGeometry(0.025, 0.025, fenceDistance * 2, 6);
  backRailGeo.rotateZ(Math.PI / 2);
  const backRail = new THREE.Mesh(backRailGeo, railMat);
  backRail.position.set(0, fenceH, -22);
  group.add(backRail);

  return group;
}
scene.add(createFence());

// ── Benches ─────────────────────────────────────────────────
function createBench(x, z, rotY) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6b4226, roughness: 0.8, metalness: 0.05,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x444444, roughness: 0.3, metalness: 0.8,
  });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), woodMat);
  seat.position.y = 0.5;
  seat.castShadow = true;
  group.add(seat);

  for (const lx of [-0.85, 0.85]) {
    for (const lz of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), metalMat);
      leg.position.set(lx, 0.25, lz);
      leg.castShadow = true;
      group.add(leg);
    }
  }

  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}
scene.add(createBench(-8, 0, Math.PI / 2));
scene.add(createBench(8, 0, -Math.PI / 2));

// ── Umpire chair ────────────────────────────────────────────
function createUmpireChair() {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a, roughness: 0.3, metalness: 0.8,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x1a4a1a, roughness: 0.7, metalness: 0.1,
  });

  const legH = 2.5;
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, legH, 0.06), metalMat);
    leg.position.set(side * 0.4, legH / 2, -0.2);
    group.add(leg);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, legH, 0.06), metalMat);
    leg2.position.set(side * 0.4, legH / 2, 0.2);
    group.add(leg2);
  }

  const platform = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.7), metalMat);
  platform.position.y = legH;
  group.add(platform);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.5), seatMat);
  seat.position.set(0, legH + 0.1, 0);
  group.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.06), seatMat);
  back.position.set(0, legH + 0.4, -0.25);
  group.add(back);

  for (let i = 0; i < 4; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.2), metalMat);
    step.position.set(0, 0.5 + i * 0.55, 0.5 + i * 0.05);
    group.add(step);
  }

  group.position.set(courtWidth / 2 + 1.5, 0, 0);
  group.castShadow = true;
  return group;
}
scene.add(createUmpireChair());

// ── Spectator stands (bleachers with back walls) ────────────
function createStands() {
  const group = new THREE.Group();
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a3a, roughness: 0.8, metalness: 0.2,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x222230, roughness: 0.9, metalness: 0.1,
  });

  // Side bleachers (both sides) with back wall
  for (const side of [-1, 1]) {
    // Tiered rows
    for (let row = 0; row < 4; row++) {
      const rowGeo = new THREE.BoxGeometry(1.2, 0.7, 30);
      const rowMesh = new THREE.Mesh(rowGeo, standMat);
      rowMesh.position.set(
        side * (28 + row * 1.2),
        0.35 + row * 0.7,
        0
      );
      rowMesh.castShadow = true;
      rowMesh.receiveShadow = true;
      group.add(rowMesh);
    }

    // Back wall behind the top row
    const wallH = 4 * 0.7 + 0.5;
    const wallGeo = new THREE.BoxGeometry(0.15, wallH, 30);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(
      side * (28 + 3 * 1.2 + 0.67),
      wallH / 2,
      0
    );
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    // Support structure underneath (angled fill)
    const supportGeo = new THREE.BoxGeometry(4 * 1.2, 0.15, 30);
    const support = new THREE.Mesh(supportGeo, wallMat);
    support.position.set(
      side * (28 + 1.8),
      0.05,
      0
    );
    support.receiveShadow = true;
    group.add(support);
  }

  return group;
}
scene.add(createStands());

// ── Floating atmospheric particles (dust/pollen in light) ───
function createAtmosphericParticles() {
  const count = 600;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = Math.random() * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    sizes[i] = 0.02 + Math.random() * 0.06;
    opacities[i] = 0.2 + Math.random() * 0.5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xffeedd) },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      varying float vOpacity;
      uniform float uTime;
      void main() {
        vOpacity = aOpacity;
        vec3 pos = position;
        // Gentle floating drift
        pos.x += sin(uTime * 0.3 + position.z * 0.5) * 0.15;
        pos.y += sin(uTime * 0.5 + position.x * 0.3) * 0.1;
        pos.z += cos(uTime * 0.2 + position.y * 0.4) * 0.12;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * (200.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vOpacity;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.1, d) * vOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geo, mat);
}
const atmosphericParticles = createAtmosphericParticles();
scene.add(atmosphericParticles);

// ── Stars (twinkling) ───────────────────────────────────────
function createStars() {
  const count = 400;
  const positions = new Float32Array(count * 3);
  const twinklePhase = new Float32Array(count);
  const twinkleSpeed = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.45;
    const r = 150 + Math.random() * 50;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    twinklePhase[i] = Math.random() * Math.PI * 2;
    twinkleSpeed[i] = 0.5 + Math.random() * 2.0;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(twinklePhase, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(twinkleSpeed, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aSpeed;
      varying float vBrightness;
      uniform float uTime;
      void main() {
        vBrightness = 0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * aSpeed + aPhase));
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = mix(0.3, 1.2, vBrightness) * (200.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vBrightness;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d) * vBrightness;
        gl_FragColor = vec4(1.0, 0.98, 0.9, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geo, mat);
}
const stars = createStars();
scene.add(stars);

// ── Horizon glow (warm sunset band on the horizon) ──────────
function createHorizonGlow() {
  const glowGeo = new THREE.PlaneGeometry(200, 20);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor1: { value: new THREE.Color(0xff8844) },
      uColor2: { value: new THREE.Color(0xffcc66) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      varying vec2 vUv;
      void main() {
        float gradient = smoothstep(0.0, 0.6, vUv.y);
        vec3 color = mix(uColor1, uColor2, vUv.y * 0.5);
        float alpha = (1.0 - gradient) * 0.12;
        // Fade out at edges horizontally
        float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        alpha *= edgeFade;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(0, 3, -80);
  return glow;
}
scene.add(createHorizonGlow());

// ── Fog (evening haze) ──────────────────────────────────────
scene.fog = new THREE.FogExp2(0x553830, 0.008);

// ── Heat shimmer ground plane (subtle distortion near court) ─
function createHeatShimmer() {
  const geo = new THREE.PlaneGeometry(20, 20);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 pos = position;
        pos.y += sin(pos.x * 3.0 + uTime) * 0.003;
        pos.y += sin(pos.z * 4.0 + uTime * 1.3) * 0.002;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        float shimmer = sin(vUv.x * 40.0 + uTime * 2.0) * sin(vUv.y * 40.0 + uTime * 1.5);
        float alpha = shimmer * 0.015;
        gl_FragColor = vec4(1.0, 0.95, 0.85, max(alpha, 0.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}
const shimmer = createHeatShimmer();
scene.add(shimmer);

// ── Load character & animations ─────────────────────────────
let mixer = null;
const actions = {};
const animationNames = [];
let currentAction = null;
let currentIndex = -1;
let tennisBall = null;

const animationFiles = {
  'Serve': 'serve.glb',
  'Forehand': 'forehand.glb',
  'Smash': 'smash.glb',
};

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.setPath('./glb/');

const allNames = Object.keys(animationFiles);
let loaded = 0;
const totalToLoad = allNames.length;

function onAllLoaded() {
  animationNames.length = 0;
  animationNames.push(...allNames);
  playAnimation(0);
  buildAnimationUI();
  document.getElementById('loading').classList.add('hidden');
}

// Load serve.glb first as the base model, then load remaining animations
loader.load('serve.glb', (gltf) => {
  const model = gltf.scene;

  const paintedBaselineZ = baselineZ - (100 / 2048) * 23.77;
  model.position.set(playerX, 0, paintedBaselineZ + 0.25);
  model.rotation.y = Math.PI + 0.2;

  model.traverse((c) => {
    c.castShadow = true;
    c.receiveShadow = true;
    if (c.material instanceof THREE.MeshStandardMaterial) {
      c.material.color.multiplyScalar(0.55);
      c.material.roughness = 0.6;
      c.material.metalness = 0.05;
    }
  });

  scene.add(model);

  tennisBall = model.getObjectByName('tennisball');

  mixer = new THREE.AnimationMixer(model);

  // Register the serve animation from the base model
  if (gltf.animations.length > 0) {
    const clip = gltf.animations[0];
    actions['Serve'] = mixer.clipAction(clip);
  }
  loaded++;
  if (loaded === totalToLoad) onAllLoaded();

  // Load the remaining animation files
  for (const [name, file] of Object.entries(animationFiles)) {
    if (name === 'Serve') continue;
    loader.load(file, (animGltf) => {
      if (animGltf.animations.length > 0) {
        const clip = animGltf.animations[0];
        actions[name] = mixer.clipAction(clip);
      }
      loaded++;
      if (loaded === totalToLoad) onAllLoaded();
    }, undefined, (err) => {
      console.error(`Failed to load ${file}:`, err);
      loaded++;
      if (loaded === totalToLoad) onAllLoaded();
    });
  }
}, undefined, (err) => {
  console.error('Failed to load serve.glb:', err);
});

function playAnimation(index) {
  const name = animationNames[index];
  const action = actions[name];
  if (!action) return;

  if (currentAction) {
    action.crossFadeFrom(currentAction, 0.3, false);
  }
  action.reset();
  action.play();

  currentAction = action;
  currentIndex = index;
  if (tennisBall) tennisBall.visible = (name === 'Serve');
  updateUIHighlight();
}

// ── Animation cycling UI ────────────────────────────────────
function buildAnimationUI() {
  const container = document.createElement('div');
  container.id = 'anim-ui';
  container.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 8px; padding: 10px 16px;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(10px);
    border-radius: 12px; z-index: 20;
    font-family: 'Helvetica Neue', sans-serif;
  `;

  for (let i = 0; i < animationNames.length; i++) {
    const btn = document.createElement('button');
    btn.textContent = animationNames[i];
    btn.dataset.index = i;
    btn.style.cssText = `
      padding: 8px 18px; border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px; background: rgba(255,255,255,0.08);
      color: #ccc; font-size: 13px; cursor: pointer;
      transition: all 0.2s;
    `;
    btn.addEventListener('click', () => playAnimation(i));
    btn.addEventListener('mouseenter', () => {
      if (i !== currentIndex) btn.style.background = 'rgba(255,255,255,0.15)';
    });
    btn.addEventListener('mouseleave', () => {
      if (i !== currentIndex) btn.style.background = 'rgba(255,255,255,0.08)';
    });
    container.appendChild(btn);
  }

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '\u25C0';
  prevBtn.style.cssText = `
    padding: 8px 12px; border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px; background: rgba(255,255,255,0.08);
    color: #ccc; font-size: 13px; cursor: pointer; transition: all 0.2s;
  `;
  prevBtn.addEventListener('click', () => {
    const idx = (currentIndex - 1 + animationNames.length) % animationNames.length;
    playAnimation(idx);
  });

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '\u25B6';
  nextBtn.style.cssText = prevBtn.style.cssText;
  nextBtn.addEventListener('click', () => {
    const idx = (currentIndex + 1) % animationNames.length;
    playAnimation(idx);
  });

  container.prepend(prevBtn);
  container.appendChild(nextBtn);
  document.body.appendChild(container);
}

function updateUIHighlight() {
  const container = document.getElementById('anim-ui');
  if (!container) return;
  const buttons = container.querySelectorAll('button');
  buttons.forEach((btn) => {
    const idx = parseInt(btn.dataset.index);
    if (idx === currentIndex) {
      btn.style.background = 'rgba(255,255,255,0.25)';
      btn.style.color = '#fff';
      btn.style.borderColor = 'rgba(255,255,255,0.5)';
    } else {
      btn.style.background = 'rgba(255,255,255,0.08)';
      btn.style.color = '#ccc';
      btn.style.borderColor = 'rgba(255,255,255,0.2)';
    }
  });
}

// Keyboard: left/right arrows to cycle
window.addEventListener('keydown', (e) => {
  if (animationNames.length === 0) return;
  if (e.key === 'ArrowRight') {
    playAnimation((currentIndex + 1) % animationNames.length);
  } else if (e.key === 'ArrowLeft') {
    playAnimation((currentIndex - 1 + animationNames.length) % animationNames.length);
  }
});

// ── Animation loop ──────────────────────────────────────────
const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  elapsed += delta;

  controls.update();
  if (mixer) mixer.update(delta);

  // Update shader uniforms
  atmosphericParticles.material.uniforms.uTime.value = elapsed;
  stars.material.uniforms.uTime.value = elapsed;
  shimmer.material.uniforms.uTime.value = elapsed;

  // Render through post-processing
  composer.render();
}
animate();

// ── Resize ──────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.resolution.set(window.innerWidth, window.innerHeight);
});

// Export for external use
window.tennisScene = { scene, camera, renderer, controls, clock, mixer };
