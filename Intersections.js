class Intersections {
  constructor(canvasWidth, canvasHeight, gridSize) {
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.gridSize = gridSize
    this.intersections = Array(canvasHeight / gridSize + 1)
    for (let row = 0; row < this.intersections.length; row++) {
      let cols = Array(canvasWidth / gridSize + 1)
      cols.fill(null)
      this.intersections[row] = cols
    }
    // console.log(this.intersections)
  }
  updateIntersection(row, col, trainNumber) {
    //if another train is at this intersection
    //raise an event for collission
    if(trainNumber){
      if (this.intersections[row][col] && (this.intersections[row][col] != trainNumber)) {
        let event = new Event('collision')
        event.train1 = this.intersections[row][col]
        event.train2 = trainNumber
        event.row = row
        event.col = col
        window.dispatchEvent(event)
      } else {
        this.intersections[row][col] = trainNumber
      }
    }else{
      this.intersections[row][col] = null
    }
  }
}
export {
  Intersections
}