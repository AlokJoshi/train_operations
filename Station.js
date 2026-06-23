class Station{
  
  static STATION_CIRCLE_RADIUS = 20
  // we need to think about the trains that pass through the station that is not related to their track. 
  // For example, if a train is passing through a station that is not on its track, then 
  // will the train stop or go through without stopping. I think it is better for the train to go through without stopping because it is not related to the train's track and it will not cause any issues for the train. However, we can add a cost for passing through a station that is not related to the train's track. This way, the user will have to invest in the station if they want their trains to pass through it without stopping. 
  // This will add an additional layer of strategy for the user when they are building their tracks and stations.
  // station is passed ctx_tracks because we want to draw the station on the tracks layer so that it appears below the trains. If we draw the station on the main ctx, then it will appear above the trains and it will look weird when the train is passing through the station.
  constructor(ctx,x,y,gridSize,distanceFromStart,trainNumber,dwellTime=30) {
    this.ctx = ctx
    this.x = x
    this.y = y
    this.distanceFromStart = distanceFromStart
    this.name = this.stationName(x,y,gridSize,trainNumber)
    // enroute station is false for Starting and Ending terminal stations and true for stations in between. 
    // This is important because we want to calculate the number of passengers boarding and alighting at each station 
    // this.enRouteStation = enRouteStation
    this.dwellTime = dwellTime
    
    // station number will start from 1 and that will indicate that it is the strting station.
    // if the station number is x and total stations are x then it is the ending station.
    // all other stations will be enroute stations. We will not need to have the enRouteStation property.
    // when we add a station graphically we will need to update the station number and totalStations properties
    // of all the stations of the train.
    this.stationNumber=0
    this.totalStations=0
  }
  stationName(x,y,gridSize,trainNumber){
    const n ='ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const col = Math.floor(x / gridSize)
    const row = Math.floor(y / gridSize)
    const colName = (col>n.length ? n[Math.floor(col / n.length)] : '') + n[col]
    const rowName = (row>n.length ? n[Math.floor(row / n.length)] : '') + n[row]
    return `T${trainNumber} : ${colName}-${rowName}`
  }
  // static getStationCost(){
  //   return this.STATION_COST_SMALL
  // }
  draw(){
    this.ctx.beginPath()
    this.ctx.arc(this.x, this.y, Station.STATION_CIRCLE_RADIUS, 0, 2 * Math.PI) 
    this.ctx.fillStyle = 'rgba(255,0,0,0.5)'
    this.ctx.fill()
    this.ctx.strokeStyle = 'rgba(255,0,0,1)'
    this.ctx.lineWidth = 2
    this.ctx.stroke()
    // we do not need this anymore because we will show the station name and other information in the popups when the 
    // train passes that station.
    // this.ctx.font = '12px Arial'
    // this.ctx.fillStyle = 'black'
    // this.ctx.fillText(this.name, this.x + 10, this.y - 10) 
  }
}

function createStation(ctx, x, y, gridSize, distanceFromStart, trainNumber, dwellTime=30) {
  return new Station(ctx, x, y, gridSize, distanceFromStart, trainNumber, dwellTime);
}

export {
  createStation
}