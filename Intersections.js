class Intersections {
  constructor(canvasWidth, canvasHeight, gridSize, offsetX = 0, offsetY = 0) {
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.gridSize = gridSize
    this.offsetX = offsetX
    this.offsetY = offsetY
    this.rowCount = Math.floor(canvasHeight / gridSize) + 1
    this.colCount = Math.floor(canvasWidth / gridSize) + 1
    this.intersections = Array.from({ length: this.rowCount }, () => Array(this.colCount).fill(null))
  }

  getCellAtPosition(x, y, threshold = 10) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null
    }

    if (x < this.offsetX || y < this.offsetY) {
      return null
    }

    const col = Math.round((x - this.offsetX) / this.gridSize)
    const row = Math.round((y - this.offsetY) / this.gridSize)

    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return null
    }

    const centerX = this.offsetX + col * this.gridSize
    const centerY = this.offsetY + row * this.gridSize
    const distanceToCenter = Math.abs(x - centerX) + Math.abs(y - centerY)

    if (distanceToCenter < threshold) {
      return { row, col, x: centerX, y: centerY }
    }

    return null
  }

  getCanvasPoint(row, col) {
    return {
      x: this.offsetX + col * this.gridSize,
      y: this.offsetY + row * this.gridSize
    }
  }

  updateIntersection(row, col, trainNumber) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return
    }
    if (this.intersections[row][col] === "Flyover" || this.intersections[row][col] === "Station") {
      return
    }
    if (trainNumber === null || trainNumber === undefined) {
      this.intersections[row][col] = null
      return
    }

    const currentTrain = this.intersections[row][col]
    if (currentTrain !== null && currentTrain !== trainNumber) {
      const event = new Event('collision')
      event.train1 = currentTrain
      event.train2 = trainNumber
      event.row = row
      event.col = col
      
      //we also want to clear the intersection to prevent multiple collision events for the same intersection
      this.intersections[row][col] = null
      window.dispatchEvent(event)
      // console.warn(`Collision detected at intersection ${row},${col} between train ${currentTrain} and train ${trainNumber}`)
    } else {
      this.intersections[row][col] = trainNumber
    }
  }

  updateIntersectionsWithFlyoverLocation(row, col, Flyover) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return
    }
    this.intersections[row][col] = Flyover? "Flyover" : null
  }

  updateIntersectionsWithStationLocation(row, col, Station) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return
    }
    this.intersections[row][col] = Station? "Station" : null
  }

  removeTrain(trainNumber) {
    for (let row = 0; row < this.rowCount; row++) {
      for (let col = 0; col < this.colCount; col++) {
        if (this.intersections[row][col] === trainNumber) {
          this.intersections[row][col] = null
        }
      }
    } 
  }
}
export {
  Intersections
}