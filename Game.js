
class Game {
  constructor() {
    this.trains = []
    // this.intersections = intersections
  }
  addTrain(train) {
    // if(!train.intersections){
    //   train.intersections=this.intersections
    // }
    this.trains.push(train)
  }
  startStopTrain(trainNumber) {
    if(trainNumber<this.trains.length){
      this.trains[trainNumber - 1].startStop()
    }
  }
  draw() {
    this.trains.forEach((train, index) => {
      train.draw()
    })
    // this.checkForCollissions()
  }
  // checkForCollissions(){

  // }
}
export {
  Game
}