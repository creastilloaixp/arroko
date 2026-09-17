import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Check, RotateCcw, Sparkles } from 'lucide-react';

type IngredientId = 'rice' | 'cucumber' | 'avocado' | 'shrimp' | 'roll';

interface RollBuilder3DProps {
  onComplete: (score: number) => void;
}

const steps: Array<{ id: IngredientId; label: string; prompt: string; emoji: string }> = [
  { id: 'rice', label: 'Arroz', prompt: 'Extiende una capa suave de arroz.', emoji: '🍚' },
  { id: 'cucumber', label: 'Pepino', prompt: 'Agrega algo verde y crujiente.', emoji: '🥒' },
  { id: 'avocado', label: 'Aguacate', prompt: 'Ahora agrega algo verde y cremoso.', emoji: '🥑' },
  { id: 'shrimp', label: 'Camarón', prompt: 'Completa el centro con camarón.', emoji: '🍤' },
  { id: 'roll', label: 'Enrollar', prompt: 'Cierra el tapete y forma tu rollo.', emoji: '🥢' },
];

const ingredientColors: Record<Exclude<IngredientId, 'rice' | 'roll'>, number> = {
  cucumber: 0x4f9c69,
  avocado: 0xa8c66c,
  shrimp: 0xf38b72,
};

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
};

const addSheetRoll = (group: THREE.Group, completed: IngredientId[]) => {
  const nori = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 0.12, 3.5),
    new THREE.MeshToonMaterial({ color: 0x132f2d }),
  );
  nori.position.y = 0.08;
  nori.receiveShadow = true;
  group.add(nori);

  if (completed.includes('rice')) {
    const rice = new THREE.Mesh(
      new THREE.BoxGeometry(4.15, 0.18, 3.16),
      new THREE.MeshToonMaterial({ color: 0xfff7e8 }),
    );
    rice.position.y = 0.22;
    rice.castShadow = true;
    group.add(rice);
  }

  (['cucumber', 'avocado', 'shrimp'] as const).forEach((id, index) => {
    if (!completed.includes(id)) return;
    const filling = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 3.25, 18),
      new THREE.MeshToonMaterial({ color: ingredientColors[id] }),
    );
    filling.rotation.z = Math.PI / 2;
    filling.position.set(0, 0.42 + index * 0.05, (index - 1) * 0.42);
    filling.castShadow = true;
    group.add(filling);
  });
};

const addFinishedRoll = (group: THREE.Group) => {
  const nori = new THREE.Mesh(
    new THREE.CylinderGeometry(1.22, 1.22, 3.7, 32, 1, true),
    new THREE.MeshToonMaterial({ color: 0x102c2a, side: THREE.DoubleSide }),
  );
  nori.rotation.z = Math.PI / 2;
  nori.position.y = 1.28;
  nori.castShadow = true;
  group.add(nori);

  const rice = new THREE.Mesh(
    new THREE.CylinderGeometry(1.08, 1.08, 3.76, 32),
    new THREE.MeshToonMaterial({ color: 0xfff7e8 }),
  );
  rice.rotation.z = Math.PI / 2;
  rice.position.y = 1.28;
  rice.castShadow = true;
  group.add(rice);

  (['cucumber', 'avocado', 'shrimp'] as const).forEach((id, index) => {
    const filling = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 3.82, 18),
      new THREE.MeshToonMaterial({ color: ingredientColors[id] }),
    );
    filling.rotation.z = Math.PI / 2;
    filling.position.set(0, 1.28 + (index === 0 ? 0.34 : -0.18), (index - 1) * 0.34);
    group.add(filling);
  });
};

const RollBuilder3D: React.FC<RollBuilder3DProps> = ({ onComplete }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rollGroupRef = useRef<THREE.Group | null>(null);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<IngredientId[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const startedAtRef = useRef(Date.now());
  const [feedback, setFeedback] = useState('Samurai Kid preparó el alga. Tú completas el rollo.');
  const [finishedScore, setFinishedScore] = useState<number | null>(null);

  const currentStep = steps[step] ?? steps[steps.length - 1];
  const choices = useMemo(() => {
    if (step === steps.length - 1) return [steps[4]];
    return [steps[0], steps[1], steps[2], steps[3]];
  }, [step]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b4f56);
    scene.fog = new THREE.Fog(0x0b4f56, 9, 18);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(7.4, 7, 8.2);
    camera.lookAt(0, 0.65, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff2d8, 0x153b40, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffe1bf, 3.2);
    keyLight.position.set(4, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(5.7, 5.7, 0.42, 48),
      new THREE.MeshToonMaterial({ color: 0xd59a59 }),
    );
    table.position.y = -0.35;
    table.receiveShadow = true;
    scene.add(table);

    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.1, 0.18, 48),
      new THREE.MeshToonMaterial({ color: 0xf5e8d2 }),
    );
    plate.position.y = -0.08;
    plate.receiveShadow = true;
    scene.add(plate);

    const rollGroup = new THREE.Group();
    scene.add(rollGroup);
    rollGroupRef.current = rollGroup;

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let animationFrame = 0;
    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      rollGroup.rotation.y += finishedScore === null ? 0.0025 : 0.009;
      const targetScale = finishedScore === null ? 1 : 1.08 + Math.sin(Date.now() * 0.004) * 0.025;
      rollGroup.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      rollGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const group = rollGroupRef.current;
    if (!group) return;
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      disposeObject(child);
    }
    if (completed.includes('roll')) addFinishedRoll(group);
    else addSheetRoll(group, completed);
  }, [completed]);

  const choose = (choice: IngredientId) => {
    if (finishedScore !== null) return;
    if (choice !== currentStep.id) {
      setMistakes((value) => value + 1);
      setFeedback(`🐉 Nori da una pista: todavía falta ${currentStep.label.toLowerCase()}.`);
      return;
    }

    const nextCompleted = [...completed, choice];
    setCompleted(nextCompleted);
    if (choice === 'roll') {
      const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const score = Math.max(55, 100 - mistakes * 8 - Math.floor(seconds / 15) * 3);
      setFinishedScore(score);
      setFeedback('🍙 ¡Rollo terminado! Samurai Kid, Nori y Roko celebran contigo.');
      window.setTimeout(() => onComplete(score), 900);
      return;
    }
    setFeedback(`✨ ¡Excelente! Nori dice: ${steps[step + 1].prompt}`);
    setStep((value) => value + 1);
  };

  const reset = () => {
    setStep(0);
    setCompleted([]);
    setMistakes(0);
    setFinishedScore(null);
    startedAtRef.current = Date.now();
    setFeedback('🥋 Samurai Kid prepara el alga. 🐉 Nori te guía con las pistas.');
  };

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <div className="overflow-hidden rounded-[24px] border-4 border-[#F4EBDD] bg-[#0B4F56] shadow-[8px_8px_0_#F15B43]">
        <div ref={mountRef} className="h-[360px] w-full sm:h-[460px]" aria-label="Vista tridimensional del rollo que estás construyendo" />
        <div className="flex items-center justify-between gap-3 bg-[#F4EBDD] px-4 py-3 text-[#07383D]">
          <p className="text-sm font-extrabold" aria-live="polite">{feedback}</p>
          <button type="button" onClick={reset} aria-label="Reiniciar rollo" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#07383D] text-white"><RotateCcw className="h-5 w-5" /></button>
        </div>
      </div>

      <aside className="rounded-[24px] bg-[#F4EBDD] p-5 text-[#07383D] shadow-[8px_8px_0_#CDBFAA] sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.12em] text-[#C83F30]">Paso {Math.min(step + 1, steps.length)} de {steps.length}</p>
          <p className="rounded-full bg-[#07383D] px-3 py-1 text-sm font-extrabold text-white">{Math.max(0, 100 - mistakes * 8)} pts</p>
        </div>
        <h2 className="mt-4 font-display text-3xl font-extrabold leading-none sm:text-4xl">{currentStep.prompt}</h2>

        <div className="mt-7 grid grid-cols-2 gap-3">
          {choices.map((choice) => {
            const done = completed.includes(choice.id);
            return (
              <button
                key={choice.id}
                type="button"
                disabled={done || finishedScore !== null}
                onClick={() => choose(choice.id)}
                className="min-h-24 rounded-2xl border-2 border-[#9EB7B4] bg-white p-3 text-left font-extrabold transition hover:-translate-y-1 hover:border-[#F15B43] disabled:cursor-default disabled:opacity-45"
              >
                <span className="text-3xl" aria-hidden="true">{choice.emoji}</span>
                <span className="mt-2 block">{choice.label} {done && <Check className="inline h-4 w-4" />}</span>
              </button>
            );
          })}
        </div>

        {finishedScore !== null && (
          <div className="mt-6 rounded-2xl bg-[#F15B43] p-5 text-white" aria-live="polite">
            <Sparkles className="h-6 w-6" />
            <p className="mt-2 font-display text-4xl font-extrabold">{finishedScore} puntos</p>
            <p className="mt-1 text-sm font-bold text-white/90">La misión se guardará en este dispositivo.</p>
          </div>
        )}
      </aside>
    </div>
  );
};

export default RollBuilder3D;
