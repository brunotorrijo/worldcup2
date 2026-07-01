/**
 * landing.js — World Cup 2026 Prediction League
 * Three.js + GSAP visual-only landing page animation
 * No app logic, no API calls, purely decorative.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const COLORS = {
    navy:  0x1A237E,
    teal:  0x00897B,
    coral: 0xD32F2F,
    gold:  0xF59E0B,
  };
  const PARTICLE_PALETTE = [COLORS.navy, COLORS.teal, COLORS.coral, COLORS.gold];

  const IS_LOW_END = navigator.hardwareConcurrency != null && navigator.hardwareConcurrency < 4;
  const IS_MOBILE  = window.innerWidth < 768;

  const PARTICLE_COUNT    = IS_LOW_END ? 15 : 40;
  const BALL_RADIUS       = IS_MOBILE ? 2.0 : 2.5;
  const CAM_Z             = IS_MOBILE ? 9 : 7;
  const MAX_TILT          = 0.3;   // radians
  const TILT_LERP_FACTOR  = 0.05;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let renderer, scene, camera;
  let ballGroup, solidMesh, wireMesh;
  let particles = [];
  let mouse = { x: 0, y: 0 };
  let targetRotation = { x: 0, y: 0 };
  let animationId = null;
  let disposed = false;

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    initThree();
    initGSAP();
  });

  // ---------------------------------------------------------------------------
  // Three.js setup
  // ---------------------------------------------------------------------------
  function initThree() {
    var canvas = document.getElementById('hero-canvas');
    if (!canvas) return; // graceful bail if canvas missing

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // transparent
    sizeRenderer();

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(60, canvasAspect(), 0.1, 100);
    camera.position.z = CAM_Z;

    // Lighting
    var ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    var pointTop = new THREE.PointLight(0xffffff, 0.8, 50);
    pointTop.position.set(5, 5, 5);
    scene.add(pointTop);

    var pointBottom = new THREE.PointLight(0x00BCD4, 0.3, 50);
    pointBottom.position.set(-4, -4, 3);
    scene.add(pointBottom);

    // Ball group (so tilt applies to the whole assembly)
    ballGroup = new THREE.Group();
    scene.add(ballGroup);

    createBall();
    createParticles();

    // Events
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('beforeunload', dispose);

    // Start render loop
    animate(0);
  }

  // ---------------------------------------------------------------------------
  // Ball
  // ---------------------------------------------------------------------------
  function createBall() {
    var geo = new THREE.IcosahedronGeometry(BALL_RADIUS, 1);

    // Solid inner mesh
    var solidMat = new THREE.MeshPhongMaterial({
      color: 0xe8edf5,
      transparent: true,
      opacity: 0.6,
      shininess: 30,
      flatShading: true,
    });
    solidMesh = new THREE.Mesh(geo, solidMat);
    ballGroup.add(solidMesh);

    // Wireframe overlay (skip on low-end)
    if (!IS_LOW_END) {
      var wireMat = new THREE.MeshPhongMaterial({
        color: 0x1A237E,
        emissive: 0x1A237E,
        emissiveIntensity: 0.35,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
      });
      wireMesh = new THREE.Mesh(geo, wireMat);
      // Slightly larger so the wireframe "sits on top"
      wireMesh.scale.setScalar(1.005);
      ballGroup.add(wireMesh);
    }
  }

  // ---------------------------------------------------------------------------
  // Particles
  // ---------------------------------------------------------------------------
  function createParticles() {
    var particleGeo = new THREE.SphereGeometry(0.05, 6, 6);

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var color = PARTICLE_PALETTE[Math.floor(Math.random() * PARTICLE_PALETTE.length)];
      var mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
      var mesh = new THREE.Mesh(particleGeo, mat);

      // Random spherical position
      var phi   = Math.random() * Math.PI * 2;
      var theta = Math.acos(2 * Math.random() - 1);
      var r     = 4 + Math.random() * 4; // radius 4-8

      mesh.position.set(
        r * Math.sin(theta) * Math.cos(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(theta)
      );

      var data = {
        mesh: mesh,
        basePos: mesh.position.clone(),
        orbitSpeed: 0.001 + Math.random() * 0.003,
        driftOffset: Math.random() * Math.PI * 2,
        radius: r,
        phi: phi,
        theta: theta,
      };

      particles.push(data);
      scene.add(mesh);
    }
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------
  function animate(time) {
    if (disposed) return;
    animationId = requestAnimationFrame(animate);

    var t = time * 0.001; // seconds

    // Ball rotation
    ballGroup.rotation.y += 0.003;
    ballGroup.rotation.x += 0.001;

    // Floating bob
    ballGroup.position.y = Math.sin(t * 0.8) * 0.15;

    // Mouse-reactive tilt (lerp towards target)
    targetRotation.x = -mouse.y * MAX_TILT;
    targetRotation.y =  mouse.x * MAX_TILT;

    ballGroup.rotation.x += (targetRotation.x - ballGroup.rotation.x) * TILT_LERP_FACTOR;
    ballGroup.rotation.y += (targetRotation.y - ballGroup.rotation.y) * TILT_LERP_FACTOR;

    // Particle drift
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.phi += p.orbitSpeed;
      var drift = Math.sin(t + p.driftOffset) * 0.3;

      p.mesh.position.x = p.radius * Math.sin(p.theta) * Math.cos(p.phi);
      p.mesh.position.y = p.radius * Math.sin(p.theta) * Math.sin(p.phi) + drift;
      p.mesh.position.z = p.radius * Math.cos(p.theta);
    }

    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------------------
  // GSAP Animations
  // ---------------------------------------------------------------------------
  function initGSAP() {
    if (typeof gsap === 'undefined') return;

    try {
      // Register ScrollTrigger
      if (typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
      }

      // ---- Hero entrance timeline ----
      var heroTL = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Use set + to pattern instead of from to avoid invisible elements on failure
      gsap.set(['.hero-eyebrow', '.hero-title', '.hero-subtitle', '.hero-desc'], { opacity: 0, y: 30 });

      heroTL.to('.hero-eyebrow', { y: 0, opacity: 1, duration: 0.6 });
      heroTL.to('.hero-title', { y: 0, opacity: 1, duration: 0.9 }, '-=0.3');
      heroTL.to('.hero-subtitle', { y: 0, opacity: 1, duration: 0.8 }, '-=0.6');
      heroTL.to('.hero-desc', { y: 0, opacity: 1, duration: 0.7 }, '-=0.5');

      // ---- CTA cards ----
      var ctaCards = document.querySelectorAll('.landing-cta-grid .card');
      if (ctaCards.length) {
        gsap.set(ctaCards, { opacity: 0, scale: 0.9 });
        gsap.to(ctaCards, {
          scale: 1,
          opacity: 1,
          duration: 0.6,
          stagger: 0.2,
          ease: 'back.out(1.4)',
          delay: 0.8,
        });
      }

      // ---- How It Works step cards (scroll-triggered) ----
      var stepCards = document.querySelectorAll('.step-card');
      if (stepCards.length && typeof ScrollTrigger !== 'undefined') {
        gsap.set(stepCards, { opacity: 0, y: 40 });
        gsap.to(stepCards, {
          scrollTrigger: {
            trigger: stepCards[0].parentElement || stepCards[0],
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.15,
          ease: 'power2.out',
        });
      }

      // ---- Footer fade-in ----
      var footer = document.querySelector('footer');
      if (footer && typeof ScrollTrigger !== 'undefined') {
        gsap.set(footer, { opacity: 0, y: 20 });
        gsap.to(footer, {
          scrollTrigger: {
            trigger: footer,
            start: 'top 95%',
            toggleActions: 'play none none none',
          },
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
        });
      }
    } catch (e) {
      // If GSAP errors, make sure everything is visible
      document.querySelectorAll('.hero-eyebrow, .hero-title, .hero-subtitle, .hero-desc, .landing-cta-grid .card, .step-card, footer').forEach(function(el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  function onResize() {
    if (!renderer || !camera) return;
    sizeRenderer();
    camera.aspect = canvasAspect();
    camera.updateProjectionMatrix();

    // Responsive camera
    camera.position.z = window.innerWidth < 768 ? 9 : 7;
  }

  function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }

  function onTouchMove(e) {
    if (!e.touches.length) return;
    mouse.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function canvasAspect() {
    var hero = document.querySelector('.landing-hero');
    if (hero) return hero.offsetWidth / hero.offsetHeight;
    return window.innerWidth / window.innerHeight;
  }

  function sizeRenderer() {
    var hero = document.querySelector('.landing-hero');
    var w = hero ? hero.offsetWidth : window.innerWidth;
    var h = hero ? hero.offsetHeight : window.innerHeight;
    renderer.setSize(w, h);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  function dispose() {
    disposed = true;
    if (animationId) cancelAnimationFrame(animationId);

    window.removeEventListener('resize', onResize);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('beforeunload', dispose);

    if (!scene) return;

    // Walk scene tree and dispose geometries + materials
    scene.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(function (m) { m.dispose(); });
        } else {
          obj.material.dispose();
        }
      }
    });

    if (renderer) {
      renderer.dispose();
      renderer = null;
    }

    scene = null;
    camera = null;
    ballGroup = null;
    solidMesh = null;
    wireMesh = null;
    particles = [];
  }
})();
