// Defines swipe model shapes.
export type SwipeDirection = "left" | "right";

export interface Swipe {
  id: string;
  swiper_id: string;
  swiped_id: string;
  direction: SwipeDirection;
  created_at: string;
}
