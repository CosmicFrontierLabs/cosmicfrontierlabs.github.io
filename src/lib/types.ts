export interface CarouselItem {
  title: string;
  description: string;
  model: string;
  camera: {
    position: { x: number; y: number; z: number };
    lookAt: { x: number; y: number; z: number };
  };
}
