class Game{
  constructor (ctxGame,ctxTracks){
    this.engines = []
  }
  addEngine(engine){
    this.engines.push(engine)
  }
  draw(){
    this.engines.forEach(engine=>{
      engine.draw()
    })
  }
}
export {
  Game
}