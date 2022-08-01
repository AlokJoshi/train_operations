class Engine {
  static length = 40
  static width = 15
  static chimneyRadius = 4
  static smokeColor = `#222`
  constructor(ctx, engineSpeed, track, color) {
    this.ctx = ctx
    this.track = track
    this.color = color
    this.engineSpeed = engineSpeed
    this.ticks = 0
    this.count = 0
  }
  draw() {
    //draw is called on each frame from the game loop
    this.tick++
    // we have to set the position of the engine based on 
    // how far it has moved on the tracks
    // console.log(this.tick)
    if (this.ticks % this.engineSpeed == 0) {
      this.count++
      const {x,y,direction}=this.getPosition(this.count)
      this.ctx.save()
      this.ctx.fillStyle = this.color
      this.ctx.translate(x, y)
      this.ctx.rotate(direction)
      this.ctx.translate(-1 * Engine.length * 0.5, -1 * Engine.width * 0.5)
      this.drawEngine(0, 0)
      this.ctx.restore()
    }
  }
  drawEngine(x, y) {

    this.ctx.rect(x, y, Engine.length * 3 / 4, Engine.width)
    this.ctx.fill()

    //steam outlet
    this.ctx.beginPath()
    this.ctx.moveTo(x + Engine.length * 0.5 + Engine.chimneyRadius, y + Engine.width * 0.5)
    this.ctx.arc(x + Engine.length * 0.5 + Engine.chimneyRadius, y + Engine.width * 0.5, Engine.chimneyRadius, 0, 2 * Math.PI)
    this.ctx.fillStyle = Engine.smokeColor
    this.ctx.fill()
    this.ctx.closePath()

    //front portion
    this.ctx.beginPath()
    this.ctx.moveTo(x + Engine.length * 3 / 4, y)
    this.ctx.quadraticCurveTo(x + Engine.length, y + Engine.width * 0.5, x + Engine.length * 3 / 4, y + Engine.width)
    // this.ctx.lineTo(x+Engine.length*3/4, y+Engine.width)
    this.ctx.closePath()
    this.ctx.fillStyle = this.color
    this.ctx.fill()

    //Coal section
    this.ctx.beginPath()
    this.ctx.rect(x, y, Engine.length / 4, Engine.width)
    this.ctx.fillStyle = `#000`
    this.ctx.closePath()
    this.ctx.fill()

  }
  getPosition(){
    //how far has the Engine travelled
    const segments = this.track.segments
    //console.log(segments)
    if(this.count>=segments[segments.length-1].distanceFromStart + segments[segments.length-1].length ){
      this.count = 0
    }
    const segment = segments.find(element => this.count < (element.distanceFromStart+element.length))
    const {startx,starty,direction} = segment
    const distance = this.count - segment.distanceFromStart
    // console.log(startx,starty,direction,distance)
    const x = startx + distance*Math.cos(direction) 
    const y = starty + distance*Math.sin(direction) 
    
    return{
      x,
      y,
      direction
    }
  }
}
export {
  Engine
}