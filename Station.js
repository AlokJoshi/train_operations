class Station{
  
  STATION_SMALL_CIRCLE_RADIUS = 10
  STATION_MEDIUM_CIRCLE_RADIUS = 15
  STATION_LARGE_CIRCLE_RADIUS = 20
  // we need to think about the trains that pass through the station that is not related to their track. 
  // For example, if a train is passing through a station that is not on its track, then 
  // will the train stop or go through without stopping. I think it is better for the train to go through without stopping because it is not related to the train's track and it will not cause any issues for the train. However, we can add a cost for passing through a station that is not related to the train's track. This way, the user will have to invest in the station if they want their trains to pass through it without stopping. 
  // This will add an additional layer of strategy for the user when they are building their tracks and stations.
  // station is passed ctx_tracks because we want to draw the station on the tracks layer so that it appears below the trains. If we draw the station on the main ctx, then it will appear above the trains and it will look weird when the train is passing through the station.
  constructor(ctx,x,y,gridSize,distanceFromStart,name,dwellTime=30,enRouteStation,type) {
    this.ctx = ctx
    this.x = x
    this.y = y
    this.distanceFromStart = distanceFromStart
    this.name = name?name:`S-${x/gridSize + 1}-${y/gridSize + 1}`
    this.enRouteStation = enRouteStation
    this.dwellTime = dwellTime
    // small=2 to 5 coaches, medium=6 to 10 coaches, large=11 to 15 coaches
    this.type = type // can be 'small', 'medium', 'large' which determines the maximum number of coaches that can be added to the train at this station
  }
  static getStationCost(type){
    return type === 'small' ? this.STATION_COST_SMALL : type === 'medium' ? this.STATION_COST_MEDIUM : this.STATION_COST_LARGE  
  }
  draw(){
    this.ctx.beginPath()
    this.ctx.arc(this.x, this.y, this.type === 'small' ? this.STATION_SMALL_CIRCLE_RADIUS : this.type === 'medium' ? this.STATION_MEDIUM_CIRCLE_RADIUS : this.STATION_LARGE_CIRCLE_RADIUS, 0, 2 * Math.PI) 
    this.ctx.fillStyle = 'rgba(255,0,0,0.5)'
    this.ctx.fill()
    this.ctx.strokeStyle = 'rgba(255,0,0,1)'
    this.ctx.lineWidth = 2
    this.ctx.stroke()
    this.ctx.font = '12px Arial'
    this.ctx.fillStyle = 'black'
    this.ctx.fillText(this.name, this.x + 10, this.y - 10) 
  }
}

function createStation(ctx, x, y, gridSize, distanceFromStart, name, dwellTime=30, enRouteStation=false, type='small') {
  return new Station(ctx, x, y, gridSize, distanceFromStart, name, dwellTime, enRouteStation, type);
}

export {
  createStation
}