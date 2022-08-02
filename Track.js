class Track {
  constructor(ctxTracks,positions) {
    //positions is an array of position objects
    //each position object is {x:?,y:?}
    this.positions = positions
    this.segments = []
    this.ctxTracks = ctxTracks
    this.draw()
    this.updateSegments()
  }
  
  delete(position) {
    //one can delete a position
    const index = this.positions.findIndex(item => item.x == position.x && item.y == position.y)
    this.positions.splice(index, 1)
    this.draw()
    this.updateSegments()
  }
  display() {
    // this.positions.forEach(item => console.log(JSON.stringify(item)))
  }
  updatePositions(){
    const tr = 10 //turning radius in pixels
    const newPositions = []
    newPositions.push(this.positions[0])
    newPositions.push(this.positions[1])
    let pp,p,c
    for(let i = 2; i < positions.length ; i++){
      pp = this.positions[i-2]  //previous to previous position
      p = this.positions[i-1]  //previous position
      c = this.positions[i]  //current position
      
      //check for straight line pattern
      if((pp.x==p.x && p.x==c.x) || (pp.y==p.y && p.y==c.y)){
        //do nothing
        newPositions.push(this.positions[i])
        continue
      }
      //if the three points are not in a straight line we need to pop the last previous
      //position and push 3 other points
      let previousModifiedPosition = newPositions.pop()
      const d1 = tr *(1-Math.cos(Math.PI/6)) //cos 30
      const d2 = tr *(1-Math.sin(Math.PI/6)) //sin 30
      //p1 and p2 are two additional points
      const p1 = p
      const p2 = p
      let p1Deltax = 0 
      let p1Deltay = 0
      let p2Deltax = 0
      let p2Deltay = 0
      //check for left to right movement
      if(pp.x<p.x && p.x==c.x && pp.y==p.y){
        //previousModifiedPosition x value is decreased by tr
        previousModifiedPosition.x -= tr
        
        //check for right down
        if(p.y<c.y){
          p1Deltax = -(tr - tr*sin(Math.PI/6))
          p1Deltay = tr-tr*cos(Math.PI/6)
          p2Deltax = -(tr-tr*sin(Math.PI/3))
          p2Deltay = tr-tr*cos(Math.PI/3) 
        }
        //check for right up
        if(p.y>c.y){
          p1Deltax = -(tr - tr*sin(Math.PI/6))
          p1Deltay = -(tr-tr*cos(Math.PI/6))
          p2Deltax = -(tr-tr*sin(Math.PI/3))
          p2Deltay = -(tr-tr*cos(Math.PI/3)) 
        }
      }
      
      //check for right to left movement
      if(pp.x>p.x && p.x==c.x && pp.y==p.y){
        //previousModifiedPosition x value is increased by tr
        previousModifiedPosition.x += tr
        //check for left down
        if(p.y<c.y){
          p1Deltax = (tr - tr*sin(Math.PI/6))
          p1Deltay = tr-tr*cos(Math.PI/6)
          p2Deltax = (tr-tr*sin(Math.PI/3))  
          p2Deltay = tr-tr*cos(Math.PI/3)       
        }
        //check for left up
        if(p.y>c.y){
          p1Deltax = (tr - tr*sin(Math.PI/6))
          p1Deltay = -(tr-tr*cos(Math.PI/6))
          p2Deltax = (tr-tr*sin(Math.PI/3))
          p2Deltay = -(tr-tr*cos(Math.PI/3)) 
        }
      }

      //check for down to up movement
      if(pp.y>p.y && p.y==c.y && pp.x==p.x){
        //previousModifiedPosition y value is increased by tr
        previousModifiedPosition.y += tr
        //check for up and left
        if(p.x>c.x){
          p1Deltax = (tr - tr*sin(Math.PI/6))
          p1Deltay = tr-tr*cos(Math.PI/6)
          p2Deltax = (tr-tr*sin(Math.PI/3))  
          p2Deltay = tr-tr*cos(Math.PI/3)       
        }
        //check for up and right
        if(p.x<c.x){
          p1Deltax = (tr - tr*cos(Math.PI/6))
          p1Deltay = (tr-tr*sin(Math.PI/6))
          p2Deltax = (tr-tr*cos(Math.PI/3))
          p2Deltay = (tr-tr*sin(Math.PI/3)) 
        }
      }

      //check for Up to down movement
      if(pp.y>p.y && p.y==c.y && pp.x==p.x){
        //previousModifiedPosition y value is increased by tr
        previousModifiedPosition.y -= tr
        //check for down and left
        if(p.x>c.x){
          p1Deltax = (tr - tr*sin(Math.PI/6))
          p1Deltay = tr-tr*sin(Math.PI/6)
          p2Deltax = (tr-tr*sin(Math.PI/3))  
          p2Deltay = tr-tr*cos(Math.PI/3)       
        }
        //check for down and right
        if(p.x<c.x){
          p1Deltax = (tr - tr*cos(Math.PI/6))
          p1Deltay = (tr-tr*sin(Math.PI/6))
          p2Deltax = (tr-tr*cos(Math.PI/3))
          p2Deltay = (tr-tr*sin(Math.PI/3)) 
        }
      }
      




    }
  }
  updateSegments() {
    //this.updatePositions()
    this.segments = []
    let diffx, diffy, direction
    let distanceFromStart = 0,length=0
    for (let i = 0; i < this.positions.length - 1; i++) {
      diffx = this.positions[i + 1].x - this.positions[i].x
      diffy = this.positions[i + 1].y - this.positions[i].y
      if(diffx==0) diffx=0.001
      //direction in radians
      direction =  Math.atan(diffy / diffx)  //this is in radians
      if(diffx<0) direction += Math.PI
      length = Math.hypot(diffx,diffy)
      this.segments.push(
        {
          distanceFromStart,
          length,
          startx: this.positions[i].x,
          starty: this.positions[i].y,
          endx: this.positions[i + 1].x,
          endy: this.positions[i + 1].y,
          direction:direction
        })
      distanceFromStart+=length
    }
    // console.log(this.positions)
    // console.log(this.segments)
  }
  draw(){
    // this.drawGrid()
    this.ctxTracks.save()
    this.ctxTracks.strokeStyle='rgb(0,0,50)'
    this.ctxTracks.beginPath()
    this.ctxTracks.moveTo(this.positions[0].x,this.positions[0].y)
    for(let i=1;i<this.positions.length;i++){
      this.ctxTracks.lineTo( this.positions[i].x,this.positions[i].y)
    }
    // this.ctxTracks.closePath()
    this.ctxTracks.stroke()
    this.ctxTracks.restore()
  }
  drawGrid(){
    const gridSize = 100
    const numCols = 1200/gridSize
    const numRows = 800/gridSize
    this.ctxTracks.strokeStyle='rgba(50,0,0,0.2)'


    this.ctxTracks.beginPath()
    
    for(let i=0;i<numCols;i++){
      this.ctxTracks.moveTo(i*gridSize,0)
      this.ctxTracks.lineTo( i*gridSize,800)
    }
    for(let j=0;j<numRows;j++){
      this.ctxTracks.moveTo(0,j*gridSize)
      this.ctxTracks.lineTo( 1200,j*gridSize)
    }
    this.ctxTracks.closePath()
    this.ctxTracks.stroke()  
  }
}

export {
  Track
}