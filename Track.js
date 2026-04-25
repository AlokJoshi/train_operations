class Track {
  constructor(ctxTracks, positions, trainName) {
    //positions is an array of position objects
    //each position object is {x:?,y:?}
    this.positions = positions
    this.newPositions = []
    this.segments = []
    this.returnSegments = []
    this.totalLength = 0
    this.ctxTracks = ctxTracks
    this.trainName=trainName 
    //this.draw()
    //this.updateSegments()
    this.updatePositions()
    this.drawUsingNewPositions()
    this.updateSegmentsFromNewPositions()
  }

  delete(position) {
    //one can delete a position
    const index = this.positions.findIndex(item => item.x == position.x && item.y == position.y)
    this.positions.splice(index, 1)
    this.draw()
    this.updateSegmentsFromNewPositions()
  }
  display() {
    // this.positions.forEach(item => console.log(JSON.stringify(item)))
  }

  updatePositions() {
    const tr = 100 //turning radius in pixels
    this.newPositions.push(this.positions[0])
    this.newPositions.push(this.positions[1])
    let pp, p, c
    for (let i = 2; i < this.positions.length; i++) {
      pp = this.positions[i - 2]  //previous to previous position
      p = this.positions[i - 1]  //previous position
      c = this.positions[i]  //current position

      //check for straight line pattern
      if ((pp.x == p.x && p.x == c.x) || (pp.y == p.y && p.y == c.y)) {
        //do nothing
        this.newPositions.push(this.positions[i])
        continue
      }
      //pop the old value of p
      this.newPositions.pop()

      //p1 and p2 are two additional points
      const p0 = {x:p.x,y:p.y}
      // const p1 = {x:p.x,y:p.y}
      // const p2 = {x:p.x,y:p.y}
      const p3 = {x:p.x,y:p.y}
      
      let n = 10 //number of points to be added between two straight lines
      let deltax = new Array(n).fill(0)
      let deltay = new Array(n).fill(0)
      //check for left to right movement
      let theta = Math.PI/(2*(n+1))
      if (pp.x < p.x && p.x == c.x && pp.y == p.y) {
        //previousModifiedPosition x value is decreased by tr
        p0.x -= tr
        //check for right down
        if (p.y < c.y) {
          
          for(let i=0;i<n;i++){
            deltax[i] = -tr * (1- Math.sin(theta * (i+1)))
            deltay[i] = tr * (1- Math.cos(theta * (i+1)))
          }
          p3.y += tr
        }
        //check for right up
        if (p.y > c.y) {
          
          for(let i=0;i<n;i++){
            deltax[i] = -tr * (1- Math.sin(theta * (i+1)))
            deltay[i] = -tr * (1- Math.cos(theta * (i+1)))
          }
          p3.y -= tr
        }
      }

      //check for right to left movement
      if (pp.x > p.x && p.x == c.x && pp.y == p.y) {
        //p0 x value is increased by tr
        p0.x += tr
        //check for left down
        if (p.y < c.y) {
          
          for(let i=0;i<n;i++){
            deltax[i] = tr * (1- Math.sin(theta * (i+1)))
            deltay[i] = tr * (1- Math.cos(theta * (i+1)))
          }
          p3.y += tr
        }
        //check for left up
        if (p.y > c.y) {
          
          for(let i=0;i<n;i++){
            deltax[i] = tr * (1- Math.sin(theta * (i+1)))
            deltay[i] = -tr * (1- Math.cos(theta * (i+1)))
          }
          p3.y -= tr
        }
      }

      //check for down to up movement
      if (pp.y > p.y && p.y == c.y && pp.x == p.x) {
        //p0 y value is increased by tr
        p0.y += tr
        //check for up and left
        if (p.x > c.x) {
          
          for(let i=0;i<n;i++){
            deltax[i] = -tr * (1- Math.cos(theta * (i+1)))
            deltay[i] = tr * (1- Math.sin(theta * (i+1)))
          }
          p3.x -= tr
        }
        //check for up and right
        if (p.x < c.x) {
          
          for(let i=0;i<n;i++){
            deltax[i] = tr * (1- Math.cos(theta * (i+1)))
            deltay[i] = tr * (1- Math.sin(theta * (i+1)))
          }
          p3.x += tr
        }
      }

      //check for Up to down movement
      if (pp.y < p.y && p.y == c.y && pp.x == p.x) {
        //p0 y value is increased by tr
        p0.y -= tr
        //check for down and left
        if (p.x > c.x) {
          
          for(let i=0;i<n;i++){
            deltax[i] = -tr * (1- Math.cos(theta * (i+1)))
            deltay[i] = -tr * (1- Math.sin(theta * (i+1)))
          }
          p3.x -= tr
        }
        //check for down and right
        if (p.x < c.x) {
          
          for(let i=0;i<n;i++){
            deltax[i] = tr * (1- Math.cos(theta * (i+1)))
            deltay[i] = -tr * (1- Math.sin(theta * (i+1)))
          }
          p3.x += tr
        }
      }

      

      this.newPositions.push(p0)
      for(let i=0;i<n;i++){
        const newP = {x:p.x + deltax[i], y:p.y + deltay[i]}
        this.newPositions.push(newP)
      }
      this.newPositions.push(p3)
      this.newPositions.push(c)
    }
  }
  buildSegments(positions) {
    const segments = []
    let distanceFromStart = 0

    for (let i = 0; i < positions.length - 1; i++) {
      const start = positions[i]
      const end = positions[i + 1]
      const dx = end.x - start.x
      const dy = end.y - start.y
      const length = Math.hypot(dx, dy)

      if (length === 0) continue

      const direction = Math.atan2(dy, dx)
      const endDistance = distanceFromStart + length

      segments.push({
        startDistance: distanceFromStart,
        endDistance,
        distanceFromStart,
        length,
        startx: start.x,
        starty: start.y,
        endx: end.x,
        endy: end.y,
        dx,
        dy,
        unitX: dx / length,
        unitY: dy / length,
        direction
      })

      distanceFromStart = endDistance
    }

    return {
      segments,
      totalLength: distanceFromStart
    }
  }

  updateSegmentsFromNewPositions() {
    const forwardPath = this.buildSegments(this.newPositions)
    const returnPath = this.buildSegments([...this.newPositions].reverse())

    this.segments = forwardPath.segments
    this.returnSegments = returnPath.segments
    this.totalLength = forwardPath.totalLength
  }

  getPoseAtDistance(distance, useReturnSegments = false) {
    const activeSegments = useReturnSegments ? this.returnSegments : this.segments

    if (activeSegments.length === 0) {
      return {
        x: -1,
        y: -1,
        direction: undefined,
        segment: null
      }
    }

    const clampedDistance = Math.max(0, Math.min(distance, this.totalLength))
    const segment = activeSegments.find(seg => clampedDistance <= seg.endDistance) || activeSegments[activeSegments.length - 1]
    const distanceIntoSegment = clampedDistance - segment.startDistance

    return {
      x: segment.startx + segment.unitX * distanceIntoSegment,
      y: segment.starty + segment.unitY * distanceIntoSegment,
      direction: segment.direction,
      segment
    }
  }
  
  draw() {
    // this.drawGrid()
    this.ctxTracks.save()
    this.ctxTracks.strokeStyle = 'rgb(0,0,250)'
    this.ctxTracks.beginPath()
    this.ctxTracks.moveTo(this.positions[0].x, this.positions[0].y)
    for (let i = 1; i < this.positions.length; i++) {
      this.ctxTracks.lineTo(this.positions[i].x, this.positions[i].y)
    }
    // this.ctxTracks.closePath()
    this.ctxTracks.stroke()
    this.ctxTracks.restore()
  }

  drawUsingNewPositions() {
    // this.drawGrid()
    
    //The name of the train
    let name_x = this.newPositions[0].x==1200? this.newPositions[0].x-100 : this.newPositions[0].x
    let name_y = this.newPositions[0].y==0? this.newPositions[0].y+100 :this.newPositions[0].y
    
    this.ctxTracks.moveTo(this.newPositions[0].x,this.newPositions[0].y-20)
    this.ctxTracks.fillText(this.trainName,name_x,name_y)
    
    
    this.ctxTracks.save()
    //draw the thick single line as backdrop
    this.ctxTracks.strokeStyle = 'rgb(255,0,255)'
    this.ctxTracks.lineWidth = 3
    this.ctxTracks.beginPath()
    this.ctxTracks.moveTo(this.newPositions[0].x, this.newPositions[0].y)
    for (let i = 1; i < this.newPositions.length; i++) {
      this.ctxTracks.lineTo(this.newPositions[i].x, this.newPositions[i].y)
    }
    // this.ctxTracks.closePath()
    this.ctxTracks.stroke()
    this.ctxTracks.restore()
    
    this.ctxTracks.save()
    //draw the thin single lline
    this.ctxTracks.strokeStyle = 'rgb(0,0,50)'
    this.ctxTracks.lineWidth = 1
    this.ctxTracks.beginPath()
    this.ctxTracks.moveTo(this.newPositions[0].x, this.newPositions[0].y)
    for (let i = 1; i < this.newPositions.length; i++) {
      this.ctxTracks.lineTo(this.newPositions[i].x, this.newPositions[i].y)
    }
    // this.ctxTracks.closePath()
    this.ctxTracks.stroke()
    this.ctxTracks.restore()
  }
  drawGrid() {
    const gridSize = 100
    const numCols = 1200 / gridSize
    const numRows = 800 / gridSize
    this.ctxTracks.strokeStyle = 'rgba(50,0,0,0.2)'


    this.ctxTracks.beginPath()

    for (let i = 0; i < numCols; i++) {
      this.ctxTracks.moveTo(i * gridSize, 0)
      this.ctxTracks.lineTo(i * gridSize, 800)
    }
    for (let j = 0; j < numRows; j++) {
      this.ctxTracks.moveTo(0, j * gridSize)
      this.ctxTracks.lineTo(1200, j * gridSize)
    }
    this.ctxTracks.closePath()
    this.ctxTracks.stroke()
  }
   getTotalLength() {
    let length = 0
    const positions = this.positions;
    for (let i = 1; i < positions.length; i++) {
      const dx = positions[i].x - positions[i - 1].x
      const dy = positions[i].y - positions[i - 1].y
      length += Math.sqrt(dx * dx + dy * dy)
    }
    return length
  }
}

export {
  Track
}