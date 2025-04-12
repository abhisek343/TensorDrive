import { Car } from './Car';
import { getIntersection, Point, Intersection, lerp } from './helpers';

export class Sensor {
    car: Car;
    rayCount: number = 5;
    rayLength: number = 150;
    raySpread: number = Math.PI / 2;

    rays: [Point, Point][] = [];
    readings: (Intersection | null)[] = []; 

    constructor(car: Car) {
        this.car = car;
    }

    update(roadBorders: Point[][], traffic: Car[]) {
        this.#castRays();
        this.readings = [];

        for (let i = 0; i < this.rays.length; i++) {

            this.readings.push(this.#getReading(this.rays[i], roadBorders, traffic));
        }

    }

    #getReading(
        ray: [Point, Point],
        roadBorders: Point[][],
        traffic: Car[]
    ): Intersection | null {
        const touches: Intersection[] = [];

        for (const border of roadBorders) {

            if (border.length >= 2) {

                 const touch = getIntersection(ray[0], ray[1], border[0], border[1]);
                 if (touch) {
                     touches.push(touch);
                 }
            }
        }

        for (const car of traffic) {

            if (car !== this.car && car.polygon.length > 0) {
                for (let j = 0; j < car.polygon.length; j++) {
                    const value = getIntersection(
                        ray[0],
                        ray[1],
                        car.polygon[j],
                        car.polygon[(j + 1) % car.polygon.length] 
                    );
                    if (value) {
                        touches.push(value);
                    }
                }
            }
        }

        if (touches.length === 0) {
            return null; 
        }

        const offsets = touches.map(e => e.offset);
        const minOffset = Math.min(...offsets);

        return touches.find(e => e.offset === minOffset) || null;
    }

    #castRays(): void {
        this.rays = [];
        for (let i = 0; i < this.rayCount; i++) {
            const rayAngle =
                lerp(
                    this.raySpread / 2,
                    -this.raySpread / 2,
                    this.rayCount === 1 ? 0.5 : i / (this.rayCount - 1)
                ) + this.car.angle;

            const start: Point = { x: this.car.x, y: this.car.y };
            const end: Point = {
                x: this.car.x - Math.sin(rayAngle) * this.rayLength,
                y: this.car.y - Math.cos(rayAngle) * this.rayLength,
            };
            this.rays.push([start, end]);
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        for (let i = 0; i < this.rayCount; i++) {
            let end: Point = this.rays[i][1]; 
            if (this.readings[i]) {

                end = this.readings[i]!;
            }

            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'yellow';
            ctx.moveTo(this.rays[i][0].x, this.rays[i][0].y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.setLineDash([2, 2]);
            ctx.moveTo(end.x, end.y); 
            ctx.lineTo(this.rays[i][1].x, this.rays[i][1].y); 
            ctx.stroke();
            ctx.setLineDash([]); 
        }
    }
}