class Train {
  static length = 20
  static width = 10
  static lengthCoach = 25
  static widthCoach = 8
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
      let { x, y, direction } = this.getPosition(0)
      this.ctx.save()
      this.ctx.fillStyle = this.color
      this.ctx.translate(x, y)
      this.ctx.rotate(direction)
      this.ctx.translate(-1 * Train.length * 0.5 , -1 * Train.width * 0.5)
      this.drawEngine(0, 0)
      this.ctx.restore()

      //draw a passenger coach
      let { x: x2, y: y2, direction: direction2 } = this.getPosition(20)
      this.ctx.save()
      this.ctx.fillStyle = this.color
      this.ctx.translate(x2, y2)
      this.ctx.rotate(direction2)
      this.ctx.translate(-1 * Train.lengthCoach * 0.5-Train.length  , -1 * Train.widthCoach * 0.5)
      this.drawCoach()
      this.ctx.restore()
    }
  }
  drawEngine(x, y) {

    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(x, y, Train.length * 3 / 4, Train.width)
    this.ctx.fill()
    this.ctx.closePath()

    //steam outlet
    this.ctx.beginPath()
    this.ctx.moveTo(x + Train.length * 0.5 + Train.chimneyRadius, y + Train.width * 0.5)
    this.ctx.arc(x + Train.length * 0.5 + Train.chimneyRadius, y + Train.width * 0.5, Train.chimneyRadius, 0, 2 * Math.PI)
    this.ctx.fillStyle = Train.smokeColor
    this.ctx.fill()
    this.ctx.closePath()

    //front portion
    this.ctx.beginPath()
    this.ctx.moveTo(x + Train.length * 3 / 4, y)
    this.ctx.quadraticCurveTo(x + Train.length, y + Train.width * 0.5, x + Train.length * 3 / 4, y + Train.width)
    // this.ctx.lineTo(x+Train.length*3/4, y+Train.width)
    this.ctx.fillStyle = this.color
    this.ctx.fill()
    this.ctx.closePath()

    //Coal section
    this.ctx.beginPath()
    this.ctx.rect(x, y, Train.length / 4, Train.width)
    this.ctx.fillStyle = `#000`
    this.ctx.fill()
    this.ctx.closePath()
    this.ctx.restore()

  }

  drawCoach() {

    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(0, 0, Train.lengthCoach * 3 / 4, Train.widthCoach)
    this.ctx.fill()
    this.ctx.closePath()
    this.ctx.restore()

  }
  getPosition(offset) {
    //how far has the Train travelled
    const segments = this.track.segments
    let x, y , direction
    //console.log(segments)
    if (this.count >= segments[segments.length - 1].distanceFromStart + segments[segments.length - 1].length) {
      this.count = 0
    }
    const segment = segments.find(seg => this.count - offset < (seg.distanceFromStart + seg.length))
    if (segment) {

      const { startx, starty } = segment
      direction = segment.direction
      const distance = this.count - segment.distanceFromStart
      // console.log(startx,starty,direction,distance)
      x = startx + distance * Math.cos(direction)
      y = starty + distance * Math.sin(direction)
    } else {
      //segment not encountered by an object offset distance behind the engine
      x = y = -1
    }

    return {
      x,
      y,
      direction:direction
    }
  }
}
export {
  Train
}