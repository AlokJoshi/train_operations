class Flyover{
  //station objet becomes necessary so that we do not register collisions at the station intersection
  //row and col are 0 based indices of the station in the grid. They are used to determine the position of the station and to check for collisions at the station intersection.
  constructor(name, row, col) {
    this.name = name
    this.row = row
    this.col = col
  }
  draw(ctx, gridSize, offsetX=0,  offsetY=0) {
    const x = offsetX + this.col * gridSize
    const y = offsetY + this.row * gridSize
    ctx.save()
    ctx.beginPath()
    ctx.fillStyle = '#444'
    ctx.arc(x, y, gridSize / 4, 0, 2 * Math.PI) // Draw a circle with radius gridSize/4
    ctx.fill()
    ctx.closePath()
    ctx.restore()
  }
}
export {
  Flyover
}