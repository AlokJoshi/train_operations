import { Train } from './Train.js'
import { financials } from './Financials.js'
class Game {
  TRAINCOLORS = ['rgba(255,0,0,0.5)',
    'rgba(125,0,255,0.5)',
    'rgba(0,0,255,0.5)',
    'rgba(255,255,0,0.5)',
    'rgba(255,0,255,0.5)',
    'rgba(0,255,255,0.5)']
  constructor() {
    this.trains = []
    // this.intersections = intersections
  }
  addTrain(ctx, ctxTemp, engineSpeed, track, numCoaches, trainName, delayBeforeStart, intersections) {

    // if there is a train that is removed and has null value in the trains array, we can reuse that train slot for the new train. This way we can keep the train number consistent and avoid issues with train numbers changing after a train is removed.
    const nullIndex = this.trains.findIndex(train => train === null)
    let trainNumber;
    if (nullIndex !== -1) {
      trainNumber = nullIndex + 1
    } else {
      trainNumber = this.trains.length + 1
    }
    const color = this.TRAINCOLORS[(trainNumber - 1) % this.TRAINCOLORS.length]
    const train = new Train(ctx, ctxTemp, engineSpeed, track, color, numCoaches, trainName, delayBeforeStart, trainNumber, intersections)
    const length = track.getTotalLength()
    financials.incrementTrackCost(length)
    financials.buyEngine()
    financials.buyCoach(numCoaches)
    this.trains[trainNumber - 1] = train
    const trainElement = document.querySelector(`#train${trainNumber}`)
    if (trainElement) {
      if(nullIndex !== -1){
        trainElement.style.filter = "none"
      } else{
      trainElement.style.display = 'flex'
      }
      trainElement.style.backgroundColor = color
    }
  }
  startStopTrain(trainNumber) {
    if (trainNumber <= this.trains.length) {
      const el= document.querySelector(`#pauseTrain${trainNumber}`)
      if(el){
        el.classList.toggle('fa-pause')
        el.classList.toggle('fa-play')
      }
      const train = this.trains[trainNumber - 1]
      train.startStop()
    }
  }
  draw() {
    this.trains.forEach((train, index) => {
      if(train){
        train.draw()
      }
    })
    // this.checkForCollissions()
  }
  increaseTrainSpeed(trainNumber) {
    if (trainNumber <= this.trains.length) {
      this.trains[trainNumber - 1].speedUp()
    }
  }
  decreaseTrainSpeed(trainNumber) {
    if (trainNumber <= this.trains.length) {
      this.trains[trainNumber - 1].slowDown()
    }
  }
  removeTrain(trainNumber) {
    if (trainNumber <= this.trains.length) {
      const train = this.trains[trainNumber - 1]
      train.startStop()
      // instead of removing the train from the array, we can set the null value for the train in the array. 
      // This way we can keep the train number consistent and avoid issues with train numbers changing after a train is removed.
      this.trains[trainNumber - 1] = null
      // we remove the track for the deleted train. We do this by
      // redrawing the tracks only for the remaining trains. This is a simple way to remove the track of the deleted train without having to implement a more complex track management system.
      this.trains.forEach(train => {
          if(train){  
            train.track.drawUsingNewPositions()
          }
      })
      const trainElement = document.querySelector(`#train${trainNumber}`)
      if (trainElement) {
        trainElement.style.filter = "blur(5px)"
      }
    }
  }
}
export {
  Game
}