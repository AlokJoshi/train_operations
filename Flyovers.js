import { Flyover } from "./Flyover.js"
import { Intersections} from "./Intersections.js"
class Flyovers {
  constructor(ctx,gridSize, offsetX=0, offsetY=0) {
    this.ctx = ctx
    this.gridSize = gridSize
    this.offsetX = offsetX
    this.offsetY = offsetY
    this.Flyovers = []
    this.possibleFlyoverLocations = []
  }
  setPossibleFlyoverLocations(locations) {
    this.possibleFlyoverLocations = locations
  }
  addFlyover(Flyover) {
    this.Flyovers.push(Flyover)
    Flyover.draw(this.ctx, this.gridSize, this.offsetX, this.offsetY)
    return Flyover
  }
  getFlyoverAtPosition(row, col) {
    return this.Flyovers.find(Flyover => Flyover.row === row && Flyover.col === col)
  }
  isFlyoverAtPosition(row, col) {
    return this.Flyovers.some(Flyover => Flyover.row === row && Flyover.col === col)
  }
  getAllFlyovers() {
    return this.Flyovers
  }
  deleteFlyover(row, col) {
    this.Flyovers = this.Flyovers.filter(Flyover => !(Flyover.row === row && Flyover.col === col))
    // Intersections.updateIntersection(row, col, null)
  }
  draw() {
    this.Flyovers.forEach(Flyover => {
      Flyover.draw(this.ctx, this.gridSize, this.offsetX, this.offsetY)
    })
  }
}
export {
  Flyovers
}