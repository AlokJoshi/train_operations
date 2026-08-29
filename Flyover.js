class Flyover{
  //Flyover objet becomes necessary so that we do not register collisions at the Flyover intersection
  //row and col are 0 based indices of the Flyover in the grid. They are used to determine the position of the Flyover and to check for collisions at the Flyover intersection.
  static FLYOVER_CIRCLE_RADIUS = 25
  
  constructor(row, col) {
    this.row = row
    this.col = col
  }
  draw(ctx, gridSize, offsetX=0,  offsetY=0) {
    const x = offsetX + this.col * gridSize
    const y = offsetY + this.row * gridSize
    ctx.save()
    ctx.beginPath()
    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)' // Blue color with 50% opacity
    ctx.arc(x, y, Flyover.FLYOVER_CIRCLE_RADIUS, 0, 2 * Math.PI) // Draw a circle with radius Flyover.FLYOVER_CIRCLE_RADIUS
    ctx.fill()
    ctx.closePath()
    ctx.restore()
  }
}
export {
  Flyover
}