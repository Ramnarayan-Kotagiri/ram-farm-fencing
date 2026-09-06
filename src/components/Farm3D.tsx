import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  polygon,
  inside,
  atPath,
  vertexFractions,
  distance,
  type Point,
} from '../geometry/coordinateTransform';
import { sideIds, sides, FT, type SideId } from '../data/farmSurvey';
import type { Scenario } from '../data/scenarios';
import { calculate, hasMesh, wireHeights, lengthFor } from '../geometry/materialCalculator';
import { supportDimensions } from '../geometry/supportGeometry';
type Props = {
  scenario: Scenario;
  result: ReturnType<typeof calculate>;
  selected: SideId | null;
  onSide: (s: SideId) => void;
  onPost: (id: string) => void;
};
const v = (p: Point, h = 0) => new T.Vector3(p.x, h, p.z);
function beam(a: T.Vector3, b: T.Vector3, r: number, material: T.Material) {
  const d = b.clone().sub(a),
    mesh = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 5), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return mesh;
}
export function Farm3D({ scenario, result, selected, onSide, onPost }: Props) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<{
      scene: T.Scene;
      camera: T.PerspectiveCamera;
      renderer: T.WebGLRenderer;
      orbit: OrbitControls;
      group: T.Group;
    } | null>(null),
    [error, setError] = useState(''),
    [mode, setMode] = useState('orbit'),
    [palms, setPalms] = useState(true),
    [spacing, setSpacing] = useState(9),
    [low, setLow] = useState(false),
    [scale, setScale] = useState(false),
    [tour, setTour] = useState(false),
    [speed, setSpeed] = useState(1),
    [offset, setOffset] = useState(2.5),
    [fraction, setFraction] = useState(0.02);
  const nav = useRef({
    mode,
    side: selected || ('W' as SideId),
    fraction,
    offset,
    tour,
    speed,
    yaw: 0,
    pitch: 0,
  });
  nav.current = { ...nav.current, mode, side: selected || 'W', fraction, offset, tour, speed };
  const callbacks = useRef({ onSide, onPost });
  callbacks.current = { onSide, onPost };
  useEffect(() => {
    if (!host.current) return;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      setError('3D is unavailable on this device. Use Survey plan and Engineering views.');
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setClearColor('#cbd9d8');
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    host.current.appendChild(renderer.domElement);
    const scene = new T.Scene();
    scene.fog = new T.Fog('#cbd9d8', 550, 1250);
    scene.add(new T.HemisphereLight('#fff5de', '#52694b', 2.8));
    const sun = new T.DirectionalLight('#fff1d2', 3);
    sun.position.set(-140, 250, -160);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -350;
    sun.shadow.camera.right = 350;
    sun.shadow.camera.top = 280;
    sun.shadow.camera.bottom = -280;
    sun.shadow.camera.far = 900;
    scene.add(sun);
    sun.target.position.set(245, 0, -5);
    scene.add(sun.target);
    const camera = new T.PerspectiveCamera(48, 1, 0.08, 2200);
    camera.position.set(155, 390, 395);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.target.set(245, 0, -5);
    orbit.enableDamping = true;
    orbit.minDistance = 2;
    orbit.maxDistance = 850;
    orbit.maxPolarAngle = Math.PI / 2 - 0.015;
    const group = new T.Group();
    scene.add(group);
    engine.current = { scene, camera, renderer, orbit, group };
    const resize = new ResizeObserver(() => {
      const w = host.current!.clientWidth,
        h = host.current!.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resize.observe(host.current);
    let frame = 0,
      last = performance.now(),
      lastUi = 0,
      drag = false,
      down = { x: 0, y: 0 },
      keys = new Set<string>();
    const pointerDown = (e: PointerEvent) => {
      drag = true;
      down = { x: e.clientX, y: e.clientY };
    };
    const pointerMove = (e: PointerEvent) => {
      if (drag && nav.current.mode !== 'orbit') {
        nav.current.yaw -= e.movementX * 0.005;
        nav.current.pitch = T.MathUtils.clamp(nav.current.pitch - e.movementY * 0.003, -1.1, 1.1);
      }
    };
    const pointerUp = (e: PointerEvent) => {
      drag = false;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect(),
        ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      for (const hit of ray.intersectObjects(group.children, true)) {
        if (hit.object.userData.posts && hit.instanceId !== undefined) {
          callbacks.current.onPost(hit.object.userData.posts[hit.instanceId].id);
          break;
        }
        if (hit.object.userData.side) {
          callbacks.current.onSide(hit.object.userData.side);
          break;
        }
      }
    };
    const keyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        keys.add(e.key);
        if (nav.current.mode !== 'orbit') e.preventDefault();
      }
    };
    const keyUp = (e: KeyboardEvent) => keys.delete(e.key);
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    const render = () => {
      const now = performance.now(),
        dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const n = nav.current;
      orbit.enabled = n.mode === 'orbit';
      if (n.mode !== 'orbit') {
        const move =
          (keys.has('w') || keys.has('ArrowUp') ? 1 : 0) -
          (keys.has('s') || keys.has('ArrowDown') ? 1 : 0);
        if (keys.has('a') || keys.has('ArrowLeft')) n.yaw += dt;
        if (keys.has('d') || keys.has('ArrowRight')) n.yaw -= dt;
        if (n.tour || move) {
          n.fraction += ((n.tour ? 12 * n.speed : 3 * move) * dt) / sides[n.side].meters;
          if (n.fraction > 1) {
            n.fraction = 0;
            callbacks.current.onSide(sideIds[(sideIds.indexOf(n.side) + 1) % 4]);
          }
          if (n.fraction < 0) n.fraction = 0;
          if (now - lastUi > 80) {
            setFraction(n.fraction);
            lastUi = now;
          }
        }
        const p = atPath(n.side, n.fraction),
          q = atPath(n.side, Math.min(1, n.fraction + 0.003)),
          prev = atPath(n.side, Math.max(0, n.fraction - 0.003)),
          dir = v(q).sub(v(prev)).normalize(),
          inward = new T.Vector3(-dir.z, 0, dir.x);
        camera.position.copy(v(p, 1.7)).addScaledVector(inward, n.offset);
        const look = n.mode === 'inspect' ? inward.clone().negate() : dir;
        look.applyAxisAngle(new T.Vector3(0, 1, 0), n.yaw);
        look.y = Math.sin(n.pitch) + (n.mode === 'inspect' ? -0.22 : 0);
        camera.lookAt(camera.position.clone().add(look));
      } else orbit.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      orbit.dispose();
      scene.traverse((obj) => {
        const m = obj as T.Mesh;
        m.geometry?.dispose();
        if (m.material)
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const { group } = e;
    group.traverse((obj) => {
      const m = obj as T.Mesh;
      m.geometry?.dispose();
      if (m.material)
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat.dispose());
    });
    group.clear();
    e.renderer.shadowMap.enabled = !low;
    const soil = new T.MeshStandardMaterial({ color: '#8c805b', roughness: 1 }),
      grass = new T.MeshStandardMaterial({ color: '#91a574', roughness: 1 }),
      concrete = new T.MeshStandardMaterial({ color: '#b9bdb0', roughness: 0.95 }),
      stayMat = new T.MeshStandardMaterial({ color: '#969e8e', roughness: 1 }),
      wireMat = new T.LineBasicMaterial({ color: '#77644a' });
    const ground = new T.Mesh(new T.PlaneGeometry(1600, 1300), grass);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(240, -0.03, 0);
    ground.receiveShadow = true;
    group.add(ground);
    const shape = new T.Shape(polygon.map((p) => new T.Vector2(p.x, -p.z))),
      farm = new T.Mesh(new T.ShapeGeometry(shape), soil);
    farm.rotation.x = -Math.PI / 2;
    farm.receiveShadow = true;
    group.add(farm);
    const road = new T.Mesh(
      new T.PlaneGeometry(5, 380),
      new T.MeshStandardMaterial({ color: '#c1a07a', roughness: 1 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(-10, 0.01, 0);
    group.add(road);
    const groups = new Map<string, typeof result.posts>();
    for (const p of result.posts) {
      const color = p.existing
        ? '#7b8b70'
        : p.reuse
          ? '#698671'
          : p.condition === 'unknown'
            ? '#b4a271'
            : p.condition === 'cracked' || p.condition === 'leaning'
              ? '#a8624d'
              : '#b9bdb0';
      if (!groups.has(color)) groups.set(color, []);
      groups.get(color)!.push(p);
    }
    for (const [color, posts] of groups) {
      const mesh = new T.InstancedMesh(
        new T.BoxGeometry(1, 1, 1),
        new T.MeshStandardMaterial({ color, roughness: 0.95 }),
        posts.length,
      );
      const dummy = new T.Object3D();
      posts.forEach((p, i) => {
        const measured = scenario.inspections[p.id]?.exposed;
        const h =
          Math.max(0.1, p.reuse && measured ? measured : p.config.poleLength - p.config.embed) * FT;
        dummy.position.set(p.x, h / 2, p.z);
        dummy.scale.set(p.strainer ? 0.17 : 0.12, h, 0.12);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.castShadow = !low;
      mesh.userData.posts = posts;
      group.add(mesh);
    }
    for (const p of result.posts) {
      if (p.existing) continue;
      const c = p.config,
        dir = v(atPath(p.side, Math.min(1, p.fraction + 0.001)))
          .sub(v(atPath(p.side, Math.max(0, p.fraction - 0.001))))
          .normalize(),
        normal = new T.Vector3(-dir.z, 0, dir.x).multiplyScalar(
          c.stayDirection === 'inside' ? 1 : -1,
        );
      if (p.stays) {
        for (let j = 0; j < p.stays; j++) {
          const { height, run } = supportDimensions(c);
          const direction = p.stays === 2 ? dir.clone().multiplyScalar(j === 0 ? -1 : 1) : normal;
          const top = v(p, height * FT),
            foot = v(p).addScaledVector(direction, run * FT);
          const delta = foot.clone().sub(top);
          const brace = new T.Mesh(new T.BoxGeometry(0.11, delta.length(), 0.11), stayMat);
          brace.position.copy(top).add(foot).multiplyScalar(0.5);
          brace.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
          group.add(brace);
        }
      }
      if (p.concrete) {
        const foot = new T.Mesh(
          c.footingShape === 'square'
            ? new T.BoxGeometry(c.footingWidth * FT, 0.025, c.footingWidth * FT)
            : new T.CylinderGeometry(
                (c.footingWidth * FT) / 2,
                (c.footingWidth * FT) / 2,
                0.025,
                10,
              ),
          concrete,
        );
        foot.position.copy(v(p, 0.013));
        group.add(foot);
      }
    }
    for (const run of result.runs) {
      const c = run.section.config;
      if (c.type === 'none') continue;
      const breaks = [
        run.start,
        ...vertexFractions(run.side).filter((t) => t > run.start && t < run.end),
        run.end,
      ];
      for (let i = 1; i < breaks.length; i++) {
        const a = atPath(run.side, breaks[i - 1]),
          b = atPath(run.side, breaks[i]),
          len = distance(a, b),
          dir = v(b).sub(v(a)).normalize();
        if (hasMesh(c)) {
          const mat = new T.ShaderMaterial({
            side: T.DoubleSide,
            transparent: true,
            depthWrite: false,
            uniforms: {
              size: { value: new T.Vector2(len, c.height * FT) },
              eye: { value: c.eye * 0.0254 },
              wire: { value: c.diameter * 0.001 },
              tint: { value: new T.Color(selected === run.side ? '#75bed2' : '#a3b2aa') },
            },
            vertexShader:
              'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader:
              'varying vec2 vUv;uniform vec2 size;uniform float eye;uniform float wire;uniform vec3 tint;void main(){vec2 p=vUv*size;vec2 d=vec2(p.x+p.y,p.x-p.y)/eye;vec2 f=abs(fract(d+0.5)-0.5);vec2 aa=fwidth(d);float line=1.0-min(smoothstep(wire/eye,wire/eye+aa.x,f.x),smoothstep(wire/eye,wire/eye+aa.y,f.y));float fade=clamp(max(aa.x,aa.y),0.0,1.0);float alpha=mix(line*0.9,0.18,fade);if(alpha<0.015)discard;gl_FragColor=vec4(tint,alpha);}',
          });
          const mesh = new T.Mesh(new T.PlaneGeometry(len, c.height * FT), mat);
          mesh.position.copy(v(a, (c.height * FT) / 2)).addScaledVector(dir, len / 2);
          mesh.rotation.y = -Math.atan2(dir.z, dir.x);
          mesh.userData.side = run.side;
          group.add(mesh);
          const border = [v(a, 0.05), v(a, c.height * FT), v(b, c.height * FT), v(b, 0.05)];
          group.add(
            new T.Line(
              new T.BufferGeometry().setFromPoints(border),
              new T.LineBasicMaterial({ color: selected === run.side ? '#469fbc' : '#86958b' }),
            ),
          );
        }
        const heights =
          c.type === 'existing'
            ? [0.35, 0.65, 0.95, 1.25, 1.55]
            : wireHeights(c).map((h) => h * FT);
        const lines: T.Vector3[] = [];
        for (const h of heights) {
          const angle =
              c.topAngle === 'straight'
                ? 0
                : (c.topAngle === 'inward' ? 1 : -1) * Math.max(0, h - c.height * FT) * 0.6,
            norm = new T.Vector3(-dir.z, 0, dir.x);
          lines.push(v(a, h).addScaledVector(norm, angle), v(b, h).addScaledVector(norm, angle));
          if (!low) {
            for (let d = 0.5; d < len; d += 1.4) {
              const pt = v(a, h).addScaledVector(dir, d).addScaledVector(norm, angle);
              lines.push(
                pt.clone().add(new T.Vector3(-0.04, -0.04, 0)),
                pt.clone().add(new T.Vector3(0.04, 0.04, 0)),
                pt.clone().add(new T.Vector3(-0.04, 0.04, 0)),
                pt.clone().add(new T.Vector3(0.04, -0.04, 0)),
              );
            }
          }
        }
        if (lines.length) {
          const wire = new T.LineSegments(
            new T.BufferGeometry().setFromPoints(lines),
            c.type === 'existing' ? new T.LineBasicMaterial({ color: '#76915d' }) : wireMat,
          );
          wire.userData.side = run.side;
          group.add(wire);
        }
      }
    }
    for (const gate of scenario.gates) {
      const a = atPath(gate.side, gate.at),
        b = atPath(gate.side, gate.at + gate.width / lengthFor(scenario, gate.side)),
        d = v(b).sub(v(a));
      if (gate.open) d.applyAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 2);
      const end = v(a).add(d),
        mat = new T.MeshStandardMaterial({ color: '#736585', metalness: 0.5, roughness: 0.5 });
      for (const h of [0.15, 0.85, 1.6]) group.add(beam(v(a, h), end.clone().setY(h), 0.025, mat));
      group.add(beam(v(a, 0.15), end.clone().setY(1.6), 0.02, mat));
    }
    if (palms) {
      const positions: Point[] = [];
      for (let z = -120, row = 0; z < 115; z += spacing * 0.866, row++)
        for (let x = 8 + ((row % 2) * spacing) / 2; x < 490; x += spacing) {
          const p = { x, z };
          if (
            inside(p) &&
            [0, Math.PI / 2, Math.PI, Math.PI * 1.5].every((a) =>
              inside({ x: x + 5 * Math.cos(a), z: z + 5 * Math.sin(a) }),
            )
          )
            positions.push(p);
        }
      const trunks = new T.InstancedMesh(
        new T.CylinderGeometry(0.19, 0.4, 4.5, low ? 4 : 7),
        new T.MeshStandardMaterial({ color: '#6b6343', roughness: 1 }),
        positions.length,
      );
      const leafGeometry = new T.BufferGeometry(),
        leafVertices: number[] = [];
      for (let k = 0; k < 14; k++) {
        const t = k / 14,
          x = 0.2 + t * 3.8,
          y = Math.sin(t * Math.PI) * 0.55 - t * t * 0.9,
          tipX = x + 0.55,
          tipY = y - 0.12,
          span = Math.sin((t * 0.85 + 0.1) * Math.PI) * 0.65;
        for (const sign of [-1, 1])
          leafVertices.push(x, y, 0, tipX, tipY, span * sign, x + 0.24, y - 0.04, 0);
      }
      leafGeometry.setAttribute('position', new T.Float32BufferAttribute(leafVertices, 3));
      leafGeometry.computeVertexNormals();
      const count = low ? 5 : 9;
      const leaves = new T.InstancedMesh(
        leafGeometry,
        new T.MeshStandardMaterial({ color: '#375a2d', side: T.DoubleSide, roughness: 1 }),
        positions.length * count,
      );
      const dummy = new T.Object3D();
      positions.forEach((p, i) => {
        dummy.position.set(p.x, 2.25, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        for (let j = 0; j < count; j++) {
          dummy.position.y = 4.2 + (j % 2) * 0.25;
          dummy.rotation.y = (j / count) * Math.PI * 2 + i * 0.63;
          dummy.updateMatrix();
          leaves.setMatrixAt(i * count + j, dummy.matrix);
        }
      });
      trunks.castShadow = !low;
      leaves.castShadow = !low;
      group.add(trunks, leaves);
    }
    if (scale) {
      const a = atPath(selected || 'W', 0.1),
        dir = v(atPath(selected || 'W', 0.11))
          .sub(v(a))
          .normalize(),
        pos = v(a).add(new T.Vector3(-dir.z, 0, dir.x).multiplyScalar(4)),
        mat = new T.MeshStandardMaterial({ color: '#d9b68d' });
      const person = new T.Group();
      const head = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), mat);
      head.position.y = 1.58;
      person.add(
        head,
        beam(new T.Vector3(0, 0.8, 0), new T.Vector3(0, 1.45, 0), 0.13, mat),
        beam(new T.Vector3(-0.08, 0.05, 0), new T.Vector3(-0.08, 0.8, 0), 0.06, mat),
        beam(new T.Vector3(0.08, 0.05, 0), new T.Vector3(0.08, 0.8, 0), 0.06, mat),
      );
      person.position.copy(pos);
      group.add(person);
    }
  }, [scenario, result, selected, palms, spacing, low, scale]);
  useEffect(() => {
    const e = engine.current;
    if (!e || mode !== 'orbit') return;
    if (selected) {
      const p = atPath(selected, 0.5),
        q = atPath(selected, 0.51),
        dir = v(q).sub(v(p)).normalize(),
        inward = new T.Vector3(-dir.z, 0, dir.x);
      e.orbit.target.copy(v(p, 1));
      e.camera.position.copy(v(p, 7)).addScaledVector(inward, 20).addScaledVector(dir, -12);
    } else {
      e.orbit.target.set(245, 0, -5);
      e.camera.position.set(155, 390, 395);
    }
    e.orbit.update();
  }, [selected, mode]);
  function snapshot() {
    const e = engine.current;
    if (e) {
      e.renderer.render(e.scene, e.camera);
      const a = document.createElement('a');
      a.href = e.renderer.domElement.toDataURL('image/png');
      a.download = 'ram-farm-3d.png';
      a.click();
    }
  }
  function step(delta: number) {
    const side = selected || 'W',
      posts = result.posts.filter((p) => p.side === side).sort((a, b) => a.fraction - b.fraction),
      next =
        delta > 0
          ? posts.find((p) => p.fraction > fraction + 0.0001)
          : [...posts].reverse().find((p) => p.fraction < fraction - 0.0001);
    if (next) setFraction(next.fraction);
  }
  return (
    <div className="three-wrap">
      <div ref={host} className="three-canvas" aria-label="Interactive three-dimensional farm" />
      {error && <p className="three-error">{error}</p>}
      <div className="three-top">
        <span className="badge dark">
          {mode === 'orbit'
            ? 'BIRD’S EYE / ORBIT'
            : mode === 'inspect'
              ? 'FENCE INSPECTION'
              : 'BOUNDARY WALK'}
        </span>
        <span className="badge dark">Synthetic scene · flat terrain</span>
      </div>
      <div className="three-controls">
        <div className="button-row">
          {[
            ['orbit', 'Orbit'],
            ['walk', 'Walk'],
            ['inspect', 'Inspect'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={mode === value ? 'active' : ''}
              onClick={() => {
                setMode(value);
                nav.current.yaw = 0;
                nav.current.pitch = 0;
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => {
              setTour(!tour);
              setMode('inspect');
            }}
          >
            {tour ? 'Pause tour' : 'Auto tour'}
          </button>
          <button onClick={snapshot}>Save PNG</button>
        </div>
        {mode !== 'orbit' && (
          <>
            <div className="walk-row">
              <button
                onClick={() => {
                  onSide(sideIds[(sideIds.indexOf(selected || 'W') + 3) % 4]);
                  setFraction(0);
                }}
              >
                Previous side
              </button>
              <button onClick={() => step(-1)}>← Post</button>
              <button onClick={() => step(1)}>Post →</button>
              <button
                onClick={() => {
                  onSide(sideIds[(sideIds.indexOf(selected || 'W') + 1) % 4]);
                  setFraction(0);
                }}
              >
                Next side
              </button>
            </div>
            <label>
              Boundary position · {Math.round(fraction * 100)}%
              <input
                aria-label="Boundary position"
                type="range"
                min="0"
                max="1"
                step=".001"
                value={fraction}
                onChange={(e) => setFraction(+e.target.value)}
              />
            </label>
            <div className="walk-row">
              <button onClick={() => setFraction(Math.max(0, fraction - 0.01))}>Back</button>
              <button onClick={() => setFraction(Math.min(1, fraction + 0.01))}>Forward</button>
              <label>
                Fence offset{' '}
                <input
                  type="number"
                  min=".5"
                  max="10"
                  step=".5"
                  value={offset}
                  onChange={(e) => setOffset(Math.max(0.5, Math.min(10, +e.target.value)))}
                />{' '}
                m
              </label>
              <label>
                Tour speed{' '}
                <select value={speed} onChange={(e) => setSpeed(+e.target.value)}>
                  <option value=".5">½×</option>
                  <option value="1">1×</option>
                  <option value="2">2×</option>
                  <option value="4">4×</option>
                </select>
              </label>
              <button
                onClick={() => {
                  setFraction(0);
                  onSide('W');
                }}
              >
                Restart
              </button>
            </div>
            <p className="tiny">
              WASD / arrows to move and turn. Drag to look. Touch: drag to look, Forward / Back to
              move.
            </p>
          </>
        )}
        <details>
          <summary>Scene settings</summary>
          <div className="walk-row">
            <label>
              <input type="checkbox" checked={palms} onChange={(e) => setPalms(e.target.checked)} />{' '}
              Oil palms
            </label>
            <label>
              <input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> Low
              detail
            </label>
            <label>
              <input type="checkbox" checked={scale} onChange={(e) => setScale(e.target.checked)} />{' '}
              1.7-m person
            </label>
            <label>
              Palm spacing{' '}
              <input
                type="number"
                min="6"
                max="18"
                value={spacing}
                onChange={(e) => setSpacing(Math.max(6, Math.min(18, +e.target.value)))}
              />{' '}
              m
            </label>
          </div>
        </details>
      </div>
    </div>
  );
}
