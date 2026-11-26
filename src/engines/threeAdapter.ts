import { CommonGameSpecification } from '../types/commonGameSpec';

export interface ThreeSceneNodeDescriptor {
  id: string;
  kind: 'plane' | 'box' | 'sphere' | 'octahedron' | 'light' | 'camera';
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
}

export interface ThreeAdapterPlan {
  readyForFuture3D: boolean;
  status: 'adaptateur_structurel_pret';
  warning: string;
  sceneName: string;
  cameraConfig: {
    type: 'PerspectiveCamera';
    fov: number;
    position: [number, number, number];
  };
  nodes: ThreeSceneNodeDescriptor[];
}

/**
 * Adaptateur structurel Three.js (fondation V2).
 * Prépare un graphe de scène 3D normalisé à partir de la CommonGameSpecification
 * sans embarquer de moteur WebGL complet dans cette phase.
 */
export const ThreeAdapter = {
  prepareScenePlan(commonSpec: CommonGameSpecification): ThreeAdapterPlan {
    const mainScene = commonSpec.scenes[0] || {
      name: commonSpec.title,
      bounds: { width: 720, height: 460, depth: 460 },
    };
    const env = commonSpec.environments[0] || {
      backgroundColor: '#0B1120',
      gridColor: '#172033',
      wallColor: '#334155',
    };
    const player = commonSpec.characters.find((c) => c.role === 'player');
    const collectibles = commonSpec.objects.find((o) => o.kind === 'collectible');
    const obstacles = commonSpec.objects.find((o) => o.kind === 'obstacle');

    const halfW = mainScene.bounds.width / 2;
    const halfH = mainScene.bounds.height / 2;

    const nodes: ThreeSceneNodeDescriptor[] = [
      {
        id: 'three_floor',
        kind: 'plane',
        position: [0, 0, 0],
        scale: [mainScene.bounds.width, 1, mainScene.bounds.height],
        color: env.backgroundColor,
      },
      {
        id: 'three_ambient_light',
        kind: 'light',
        position: [0, 320, 0],
        scale: [1, 1, 1],
        color: '#FFFFFF',
      },
    ];

    if (player) {
      nodes.push({
        id: 'three_player_mesh',
        kind: 'sphere',
        position: [player.position.x - halfW, player.radius, player.position.y - halfH],
        scale: [player.radius, player.radius, player.radius],
        color: player.color,
      });
    }

    if (collectibles) {
      nodes.push({
        id: 'three_collectible_prototype',
        kind: 'octahedron',
        position: [0, 12, 0],
        scale: [collectibles.radius || 10, collectibles.radius || 10, collectibles.radius || 10],
        color: collectibles.color,
      });
    }

    if (obstacles && obstacles.count > 0) {
      nodes.push({
        id: 'three_obstacle_prototype',
        kind: 'box',
        position: [60, 24, 40],
        scale: [obstacles.minSize || 48, 48, obstacles.minSize || 48],
        color: obstacles.color,
      });
    }

    return {
      readyForFuture3D: true,
      status: 'adaptateur_structurel_pret',
      warning:
        'Rendu 3D Three.js non actif en V2 : cet adaptateur traduit uniquement la spécification commune en descripteur de scène pour la prochaine étape.',
      sceneName: mainScene.name,
      cameraConfig: {
        type: 'PerspectiveCamera',
        fov: commonSpec.cameras[0]?.fov || 55,
        position: [0, 420, 360],
      },
      nodes,
    };
  },
};
