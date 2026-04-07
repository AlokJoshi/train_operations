class Tracks{
  constructor(ctxTracks){
    this.tracks = []
    this.ctxTracks = ctxTracks
  }
  add(track){
    this.tracks.push(track)
  }
  draw(){
    this.tracks.forEach(track => {
      //track.draw()
    });
  }
  
}

export {
  Tracks
}