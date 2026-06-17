import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Pane } from 'tweakpane';


class App {

  #threejs_ = null;
  #camera_ = null;
  
  #scene_ = null;
  #clock_ = null;
  #controls_ = null;

  #mixer_ = null;

  constructor() {
  }

  async initialize() {
    this.#clock_ = new THREE.Clock(true);

    window.addEventListener('resize', () => {
      this.#onWindowResize_();
    }, false);

    await this.#setupProject_();

    this.#onWindowResize_();
    this.#raf_();
  }

  async #setupProject_() {
    this.#threejs_ = new THREE.WebGLRenderer( { antialias: true } );
    this.#threejs_.shadowMap.enabled = true;
    this.#threejs_.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.#threejs_.domElement);

    const fov = 70;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1;
    const far = 1000;
    this.#camera_ = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.#camera_.position.set(3, 2, 3);
    this.#camera_.lookAt(new THREE.Vector3(0, 0, 0));

    this.#controls_ = new OrbitControls(this.#camera_, this.#threejs_.domElement);
    this.#controls_.enableDamping = true;
    this.#controls_.target.set(0, 1, 0);

    this.#scene_ = new THREE.Scene();
    this.#scene_.background = new THREE.Color(0x000000);

    // Create debug page
    const pane = new Pane();

    this.#SetupBasicScene_(pane);
  }

  #SetupBasicScene_(pane) {
    // Light
    const light = new THREE.DirectionalLight(0xFFFFFF, 2.0);
    light.position.set(5, 20, 5);
    light.lookAt(new THREE.Vector3());
    light.castShadow = true;
    light.shadow.mapSize.setScalar(1024);
    light.shadow.camera.near = 1.0;
    light.shadow.camera.far = 100;
    light.shadow.camera.left = -5;
    light.shadow.camera.right = 5;
    light.shadow.camera.top = 5;
    light.shadow.camera.bottom = -5;
    light.shadow.bias = -0.001;
    this.#scene_.add(light);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(4, 4);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x202020,
      metalness: 0.1,
      roughness: 0.6,
    });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.#scene_.add(groundMesh);

    const bgFolder = pane.addFolder({ title: 'Background' });

    this.#scene_.backgroundBlurriness = 0.4;
    this.#scene_.backgroundIntensity = 0.5;
    this.#scene_.environmentIntensity = 0.5;

    bgFolder.addBinding(this.#scene_, 'backgroundBlurriness', { min: 0, max: 1, step: 0.01 });
    bgFolder.addBinding(this.#scene_, 'backgroundIntensity', { min: 0, max: 1, step: 0.01 });
    bgFolder.addBinding(this.#scene_, 'environmentIntensity', { min: 0, max: 1, step: 0.01 });

    this.#LoadRGBE_('./resources/skybox/rosendal_park_sunset_1k.hdr');
    // this.#LoadKenney_(pane);
    this.#LoadMixamo_(pane);
  }

  #LoadMixamo_(pane) {
    const animFolder = pane.addFolder({ title: 'Animation' });

    const loader = new GLTFLoader();
    loader.setPath('./resources/models/');
    loader.load('ybot.glb', (gltf) => {
      gltf.scene.traverse((c) => {
        c.castShadow = true;
        c.receiveShadow = true;

        if (c.material instanceof THREE.MeshStandardMaterial) {
          c.material.roughness = 0.25;
          c.material.metalness = 0;
        }
      });
      this.#scene_.add(gltf.scene);

      const animationFiles = {
        'Idle': 'ybot-idle.glb',
        'Walk': 'ybot-walk.glb',
        'Run': 'ybot-run.glb',
        'Dance': 'ybot-dance.glb',
      };

      const debugParams = {
        animation: {
          type: '',
          options: {},
        }
      };

      this.#mixer_ = new THREE.AnimationMixer(gltf.scene);

      const manager = new THREE.LoadingManager();
      const actions = {};

      const animLoader = new GLTFLoader(manager);
      animLoader.setPath('./resources/models/');
      for (let key in animationFiles) {
        animLoader.load(animationFiles[key], (gltf) => {
          const clip = gltf.animations[0];
          const action = this.#mixer_.clipAction(clip);
          actions[key] = action;
          debugParams.animation.options[key] = key;
        });
      }

      manager.onLoad = () => {
        let previousAction = null;
        animFolder.addBinding(debugParams.animation, 'type', {
          options: debugParams.animation.options,
        }).on('change', (evt) => {
          const action = actions[evt.value];
  
          if (previousAction) {
            // previousAction.stop();
            action.crossFadeFrom(previousAction, 0.1, false);
          }
          action.reset();
          action.play();
  
          previousAction = action;
        });
      };
    });
  }

  #LoadKenney_(pane) {
    const animFolder = pane.addFolder({ title: 'Animation' });

    const loader = new GLTFLoader();
    loader.setPath('./resources/models/platformer/');
    loader.load('character.glb', (gltf) => {
      gltf.scene.scale.setScalar(2);
      gltf.scene.traverse((c) => {
        c.castShadow = true;
        c.receiveShadow = true;

        if (c.material instanceof THREE.MeshStandardMaterial) {
          c.material.roughness = 0.25;
          c.material.metalness = 0.2;
        }
      });
      this.#scene_.add(gltf.scene);

      const debugParams = {
        animation: {
          type: '',
          options: {},
        }
      };

      this.#mixer_ = new THREE.AnimationMixer(gltf.scene);
      const actions = {};

      for (let i = 0; i < gltf.animations.length; i++) {
        const clip = gltf.animations[i];
        const action = this.#mixer_.clipAction(clip);

        actions[clip.name] = action;

        debugParams.animation.options[clip.name] = clip.name;
      }

      debugParams.animation.type = gltf.animations[0].name;

      let previousAction = null;
      animFolder.addBinding(debugParams.animation, 'type', {
        options: debugParams.animation.options,
      }).on('change', (evt) => {
        const action = actions[evt.value];

        if (previousAction) {
          // previousAction.stop();
          action.crossFadeFrom(previousAction, 0.5, false);
        }
        action.reset();
        action.play();

        previousAction = action;
      });
    });
  }

  #LoadRGBE_(path) {
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load(path , (hdrTexture) => {
      hdrTexture.mapping = THREE.EquirectangularReflectionMapping;

      this.#scene_.background = hdrTexture;
      this.#scene_.environment = hdrTexture;
    });
  }

  #onWindowResize_() {
    const dpr = window.devicePixelRatio;
    const canvas = this.#threejs_.domElement;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const aspect = w / h;

    this.#threejs_.setSize(w * dpr, h * dpr, false);
    this.#camera_.aspect = aspect;
    this.#camera_.updateProjectionMatrix();
  }

  #raf_() {
    requestAnimationFrame((t) => {
      this.#step_(this.#clock_.getDelta());
      this.#render_();
      this.#raf_();
    });
  }

  #render_() {
    this.#threejs_.render(this.#scene_, this.#camera_);
  }

  #step_(timeElapsed) {
    this.#controls_.update(timeElapsed);
    if (this.#mixer_) {
      this.#mixer_.update(timeElapsed);
    }
  }
}


let APP_ = null;

window.addEventListener('DOMContentLoaded', async () => {
  APP_ = new App();
  await APP_.initialize();
});
