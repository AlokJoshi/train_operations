"use strict";
class Train {
  static lengthEngine = 40
  static widthEngine = 14
  static lengthCoach = 20
  static widthCoach = 12
  static chimney_r = 30
  static smokeColor = `#222`
  static coachColor = `#00ff00`
  static intersectionDist = 10

  constructor(ctx, ctxTemp, engineSpeed, track, color, numCoaches, trainName, delayBeforeStart, trainNumber, intersections) {
    this.ctx = ctx
    this.ctxTemp = ctxTemp
    this.track = track
    this.color = color
    this.engineSpeed = 11 - engineSpeed
    this.numCoaches = numCoaches ? numCoaches : 2
    this.ticks = 0
    this.count = 0
    this.trainName = trainName
    this.trainNumber = trainNumber
    this.paused = false
    this.delayBeforeStart = delayBeforeStart ? delayBeforeStart : 1
    this.intersections = intersections
    this.currentIntersectionRow = null
    this.currentIntersectionCol = null
    this.beep = new Audio('./beep.mp3')
  }

  startStop() {
    this.paused = !this.paused
  }
  draw() {
    //draw is called on each frame from the game loop
    const d = 2 //distance between one coach and the next
    this.ticks++
    //train is not drawn till this.ticks reach a certain level
    if (this.ticks < this.delayBeforeStart * 100) return

    // we have to set the position of the engine based on 
    // how far it has moved on the tracks
    // console.log(this.tick)
    if ((this.ticks % this.engineSpeed == 0) && !this.paused) {
      this.count += 1
    }

    let { x, y, direction } = this.getPosition(0)
    this.ctx.save()
    this.ctx.fillStyle = this.color
    this.ctx.translate(x, y)
    this.ctx.rotate(direction)
    this.ctx.translate(-1 * Train.lengthEngine * 0.5, -1 * Train.widthEngine * 0.5)
    this.drawEngine(0, 0)
    this.ctx.restore()

    // console.log(this.currentIntersectionRow,this.currentIntersectionCol)
    if (Math.abs(x - Math.round(x / 100) * 100) + Math.abs(y - Math.round(y / 100) * 100) < Train.intersectionDist &&
      //Math.abs(y - Math.round(y / 100) * 100) < Train.intersectionDist &&
      (this.currentIntersectionRow == null || this.currentIntersectionCol == null)) {
      const col = Math.round(x / 100)
      const row = Math.round(y / 100)
      this.currentIntersectionRow = row
      this.currentIntersectionCol = col
      this.displayIntersection(row, col)
      // this.beep.play()
      // console.log(`Train:${this.trainNumber} entering intersection ${x},${y},${row},${col},${this.ticks}`)
      this.intersections.updateIntersection(row, col, this.trainNumber)
      // let pixels = Train.lengthEngine + Train.lengthCoach * this.numCoaches + Train.intersectionDist
      // let pixelsPerSecond = 60 / this.engineSpeed //60 fps
      // let time = pixels * 1000 / pixelsPerSecond  //time in milliseconds
      // console.log(time)
      // setTimeout(() => {
      //   this.clearIntersection(row, col)
      //   // this.beep.play()
      //   this.intersections.updateIntersection(row, col, null)
      //   this.currentIntersectionRow = null
      //   this.currentIntersectionCol = null
      //   // console.log(`Train:${this.trainNumber} leaving intersection ${x},${y},${row},${col},${this.ticks}`)
      // }, time)
    }
    
    //draw a passenger coach
    //distance between center of engine and center of coach is 
    for (let coachNum = 0; coachNum < this.numCoaches; coachNum++) {
      // let gap = Train.lengthEngine + Train.lengthCoach * (coachNum + 1)
      let gap = (Train.lengthEngine + Train.lengthCoach + 2*d)*0.5 + ((Train.lengthCoach + d) * (coachNum ))
      let { x: x2, y: y2, direction: direction2 } = this.getPosition(gap)
      
      const distanceToCoach = -1 * Train.lengthCoach * (coachNum + 0.5) - Train.lengthEngine
      this.ctx.save()
      this.ctx.fillStyle = this.color
      this.ctx.translate(x2, y2)
      this.ctx.rotate(direction2)
      //this.ctx.translate(distanceToCoach, -1 * Train.widthCoach * 0.5)
      this.ctx.translate(-10, -1 * Train.widthCoach * 0.5)
      this.drawCoach()
      this.ctx.restore()
      
      if(this.currentIntersectionCol && this.currentIntersectionRow){
        // let totalDistance = x2+y2
        // console.log(totalDistance)
        if((Math.abs(x2 - this.currentIntersectionCol*100) + Math.abs(y2 -this.currentIntersectionRow*100) + distanceToCoach < Train.intersectionDist) && 
        coachNum==this.numCoaches-1 ){
          //console.log(x2+y2+distanceToCoach)
          this.clearIntersection(this.currentIntersectionRow,this.currentIntersectionCol)
          this.intersections.updateIntersection(this.currentIntersectionRow, this.currentIntersectionCol, null)
          this.currentIntersectionRow = null
          this.currentIntersectionCol = null
          //this.beep.play()
        }
      }
    }
    return { x, y, width: Train.lengthEngine + Train.lengthCoach * this.numCoaches + 5 }
  }
  drawEngine(x, y) {

    let chimneyRadius = Train.widthEngine * Train.chimney_r / 100

    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(x, y, Train.lengthEngine * 3 / 4, Train.widthEngine)
    this.ctx.fill()
    this.ctx.closePath()

    //steam outlet
    this.ctx.beginPath()
    this.ctx.moveTo(x + Train.lengthEngine * 0.5 + chimneyRadius, y + Train.widthEngine * 0.5)
    this.ctx.arc(x + Train.lengthEngine * 0.5 + chimneyRadius, y + Train.widthEngine * 0.5, chimneyRadius, 0, 2 * Math.PI)
    this.ctx.fillStyle = Train.smokeColor
    this.ctx.fill()
    this.ctx.closePath()

    //front portion
    this.ctx.beginPath()
    this.ctx.moveTo(x + Train.lengthEngine * 3 / 4, y)
    this.ctx.quadraticCurveTo(x + Train.lengthEngine, y + Train.widthEngine * 0.5, x + Train.lengthEngine * 3 / 4, y + Train.widthEngine)
    // this.ctx.lineTo(x+Train.lengthEngine*3/4, y+Train.widthEngine)
    this.ctx.fillStyle = this.color
    this.ctx.fill()
    this.ctx.closePath()

    //Coal section
    this.ctx.beginPath()
    this.ctx.rect(x, y, Train.lengthEngine / 4, Train.widthEngine)
    this.ctx.fillStyle = `#000`
    this.ctx.fill()
    this.ctx.closePath()
    this.ctx.restore()

  }

  drawCoach() {

    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.fillStyle = Train.coachColor
    this.ctx.strokeStyle = '#333'
    this.ctx.rect(0, 0, Train.lengthCoach, Train.widthCoach)
    this.ctx.fill()
    this.ctx.stroke()
    this.ctx.closePath()
    this.ctx.restore()

  }
  getPosition(offset) {
    //how far has the Train travelled
    const distance = this.count - offset
    return this.track.getPoseAtDistance(distance)
  }

  displayIntersection(row, col) {
    this.ctxTemp.fillStyle='red'
    this.ctxTemp.beginPath()
    //this.ctxTemp.moveTo(col * 100, row * 100)
    this.ctxTemp.arc(col * 100, row * 100, 5, 0, Math.PI * 2)
    this.ctxTemp.fill()
  }

  clearIntersection(row, col) {
    this.ctxTemp.clearRect(col * 100 - 5, row * 100 - 5, 10, 10)
    // this.ctxTemp.clearRect(0,0,1200,800)
  }

}

export {
  Train
}