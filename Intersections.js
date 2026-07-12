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
    this.laneOccupancy = new Map()
    this.allowedTrainsByCell = new Map()
  }

  getCellKey(row, col) {
    return `${row},${col}`
  }

  // Returns the cell at the given canvas position if it is within the 
  // threshold distance from the cell center, otherwise returns null.
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

  getCellFromCanvasPoint(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null
    }
    const col = Math.round((x - this.offsetX) / this.gridSize)
    const row = Math.round((y - this.offsetY) / this.gridSize)
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return null
    }
    return { row, col }
  }

  allowTrainsAtCell(row, col, trainNumbers = []) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return
    }
    const validTrainNumbers = trainNumbers.filter((trainNumber) => Number.isFinite(trainNumber))
    if (validTrainNumbers.length < 2) {
      return
    }

    const key = this.getCellKey(row, col)
    const allowedTrains = this.allowedTrainsByCell.get(key) ?? new Set()
    validTrainNumbers.forEach((trainNumber) => allowedTrains.add(trainNumber))
    this.allowedTrainsByCell.set(key, allowedTrains)
  }

  allowTrainsForCommonSegments(commonSegmentsMap, trainNumbers = []) {
    if (!(commonSegmentsMap instanceof Map)) {
      return
    }

    commonSegmentsMap.forEach((segment) => {
      const startCell = this.getCellFromCanvasPoint(segment.startx, segment.starty)
      const endCell = this.getCellFromCanvasPoint(segment.endx, segment.endy)
      if (startCell) {
        this.allowTrainsAtCell(startCell.row, startCell.col, trainNumbers)
      }
      if (endCell) {
        this.allowTrainsAtCell(endCell.row, endCell.col, trainNumbers)
      }
    })
  }

  updateIntersection(row, col, trainNumber, lane = 0) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return
    }
    if (this.intersections[row][col] === "Flyover" || this.intersections[row][col] === "Station") {
      return
    }

    const laneNumber = Number.isFinite(lane) ? lane : 0
    const key = this.getCellKey(row, col)
    const occupancyByLane = this.laneOccupancy.get(key)

    if (trainNumber === null || trainNumber === undefined) {
      if (!occupancyByLane) return
      occupancyByLane.delete(laneNumber)
      if (occupancyByLane.size === 0) {
        this.laneOccupancy.delete(key)
      }
      return
    }

    const lanes = occupancyByLane ?? new Map()
    const currentTrain = lanes.get(laneNumber)
    if (currentTrain != null && currentTrain !== trainNumber) {
      const allowedTrains = this.allowedTrainsByCell.get(key)
      if (allowedTrains && allowedTrains.has(currentTrain) && allowedTrains.has(trainNumber)) {
        return
      }

      const event = new Event('collision')
      event.train1 = currentTrain
      event.train2 = trainNumber
      event.row = row
      event.col = col
      event.lane = laneNumber
      
      //we also want to clear the intersection to prevent multiple collision events for the same intersection
      lanes.delete(laneNumber)
      if (lanes.size === 0) {
        this.laneOccupancy.delete(key)
      } else {
        this.laneOccupancy.set(key, lanes)
      }
      window.dispatchEvent(event)
      // console.warn(`Collision detected at intersection ${row},${col} between train ${currentTrain} and train ${trainNumber}`)
    } else {
      lanes.set(laneNumber, trainNumber)
      this.laneOccupancy.set(key, lanes)
    }
  }

  updateIntersectionsWithFlyoverLocation(row, col, Flyover) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return
    }
    this.intersections[row][col] = Flyover? "Flyover" : null
    this.laneOccupancy.delete(this.getCellKey(row, col))
  }

  updateIntersectionsWithStationLocation(row, col, Station) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return
    }
    this.intersections[row][col] = Station? "Station" : null
    this.laneOccupancy.delete(this.getCellKey(row, col))
  }

  removeTrain(trainNumber) {
    this.laneOccupancy.forEach((occupancyByLane, key) => {
      occupancyByLane.forEach((occupiedTrain, laneNumber) => {
        if (occupiedTrain === trainNumber) {
          occupancyByLane.delete(laneNumber)
        }
      })

      if (occupancyByLane.size === 0) {
        this.laneOccupancy.delete(key)
      }
    })

    this.allowedTrainsByCell.forEach((allowedTrains, key) => {
      if (allowedTrains.has(trainNumber)) {
        allowedTrains.delete(trainNumber)
        if (allowedTrains.size < 2) {
          this.allowedTrainsByCell.delete(key)
        }
      }
    })

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