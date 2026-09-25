// Train.js
globalThis.debugTrainNumber = null;
globalThis.setDebugTrain = (trainNumber) => {
  const value = Number(trainNumber);
  globalThis.debugTrainNumber = Number.isInteger(value) ? value : null;
  console.log(`[debug] monitoring train ${globalThis.debugTrainNumber ?? "none"}`);
};
var Train = class _Train {
  static lengthEngine = 40;
  static widthEngine = 14;
  static lengthCoach = 20;
  static widthCoach = 12;
  static chimney_r = 30;
  static maxSmokePuffs = 60;
  static smokeColor = `#222`;
  static coachColor = `#4444ff`;
  static freightWagonColor = `#ff4444`;
  static intersectionDist = 10;
  static maxNumCoaches = 15;
  static maxNumFreightWagons = 50;
  static minNumCoaches = 2;
  static minNumFreightWagons = 10;
  static coachPassengerCapacity = 100;
  static baseTicketPrice = 400;
  static freightWagonCapacity = 2e4;
  // fixed raw material capacity per freight coach to keep it simple. We can adjust this as needed to make it more realistic.
  static freightChargePerUnit = 100;
  // fixed charge per unit of raw material to keep it simple. Revenue is calculated based on the amount of raw material unloaded at the station.
  static MAX_RENDERED_OPERATION_ROWS = 60;
  static ticketPriceMap = /* @__PURE__ */ new Map();
  // key is from row,col to row,col and value is the ticket price for that route. 
  // We populate this as we go unless the ticket price is already in the map. 
  constructor({
    ctx: ctx2,
    ctxTemp: ctxTemp2,
    track,
    color,
    numCoaches,
    trainName,
    delayBeforeStart = 1,
    trainNumber,
    intersections: intersections2,
    financials,
    travelPopulation,
    rawMaterialDemand,
    rawMaterialSupply,
    getCurrentTimeIndex,
    trainType = "passenger",
    lane = 0,
    visualLengthScale = 1,
    maxVisualCoaches,
    // popups,
    trainInfo,
    runningScriptedDemo: runningScriptedDemo2 = false
  } = {}) {
    this.ctx = ctx2;
    this.ctxTemp = ctxTemp2;
    this.track = track;
    this.color = color;
    this.trainType = trainType;
    const maxInitialCoaches = this.trainType === "freight" ? _Train.maxNumFreightWagons : _Train.maxNumCoaches;
    const minInitialCoaches = this.trainType === "freight" ? _Train.minNumFreightWagons : _Train.minNumCoaches;
    this.numCoaches = numCoaches ? Math.min(Math.max(numCoaches, minInitialCoaches), maxInitialCoaches) : Math.floor((minInitialCoaches + maxInitialCoaches) / 2);
    this.ticks = 0;
    this.count = 0;
    this.isReturning = false;
    this.trainName = trainName;
    this.trainNumber = trainNumber;
    this.visualLengthScale = Math.max(0.2, Math.min(1, visualLengthScale));
    this.hasExplicitVisualCoachCap = maxVisualCoaches != null;
    this.maxVisualCoaches = Math.max(1, this.hasExplicitVisualCoachCap ? maxVisualCoaches : this.numCoaches);
    this.paused = false;
    this.userPaused = false;
    this.dwellPaused = false;
    this.delayBeforeStart = delayBeforeStart;
    this.intersections = intersections2;
    this.activeIntersections = /* @__PURE__ */ new Map();
    this.lane = Number.isFinite(lane) ? lane : 0;
    this.trainlength = _Train.lengthEngine + (_Train.lengthCoach + 2) * this.numCoaches;
    this.financials = financials;
    this.getCurrentTimeIndex = getCurrentTimeIndex;
    this.dysfunctional = false;
    this.repairTime = 5e3;
    this.repairticks = 0;
    this.stations = track.getStations();
    this.passengerMap = /* @__PURE__ */ new Map();
    this.travelPopulation = travelPopulation;
    this.totalTravelPopulation = Array.from(this.travelPopulation.travelPopulation.values()).reduce((a, b) => a + b.population, 0);
    this.passengersOnBoard = 0;
    this.lastProcessedStationVisitKey = null;
    this.stationVisitContext = null;
    this.remainingDwellTime = 0;
    this.freightTrainDwellTime = 200;
    this.rawMaterialDemand = rawMaterialDemand;
    this.rawMaterialSupply = rawMaterialSupply;
    this.rawMaterialOnBoard = 0;
    this.distanceTraveledInTimeUnit = 0;
    if (!trainInfo) {
      throw new Error("TrainInfo instance required");
    }
    this.trainInfo = trainInfo;
    this.tripNumber = 1;
    this.speed = this.trainType == "passenger" ? 1 : 11;
    this.upgradedEngine = false;
    this.parallelSegmentCells = this.buildParallelSegmentCellSet();
    this.awaitingTurnaround = false;
    this.smokePuffs = [];
    this.lastSmokeEmitTick = 0;
    this.smokeSetting = "high";
    this.runningScriptedDemo = runningScriptedDemo2;
    this.updateUI();
  }
  shouldLogDebug() {
    const targetTrainNumber = Number(globalThis.debugTrainNumber);
    return Number.isInteger(targetTrainNumber) && this.trainNumber === targetTrainNumber;
  }
  normalizeSmokeSetting(level) {
    const value = typeof level === "string" ? level.toLowerCase() : "high";
    if (value === "off" || value === "low" || value === "high") {
      return value;
    }
    return "high";
  }
  setSmokeSetting(level) {
    this.smokeSetting = this.normalizeSmokeSetting(level);
    if (this.smokeSetting === "off") {
      this.smokePuffs.length = 0;
    }
    return this.smokeSetting;
  }
  buildParallelSegmentCellSet() {
    const cells = /* @__PURE__ */ new Set();
    if (!this.track?.overlapMatches?.length) {
      return cells;
    }
    const stepSize = Number.isFinite(this.intersections?.gridSize) && this.intersections.gridSize > 0 ? this.intersections.gridSize : 1;
    this.track.overlapMatches.forEach((match) => {
      if (!(match?.commonSegmentsMap instanceof Map)) {
        return;
      }
      match.commonSegmentsMap.forEach((segment) => {
        if (!segment) {
          return;
        }
        const dx = segment.endx - segment.startx;
        const dy = segment.endy - segment.starty;
        const maxAxisDistance = Math.max(Math.abs(dx), Math.abs(dy));
        const steps = Math.max(1, Math.round(maxAxisDistance / stepSize));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = segment.startx + dx * t;
          const py = segment.starty + dy * t;
          const cell = this.intersections.getCellFromCanvasPoint(px, py);
          if (!cell) {
            continue;
          }
          cells.add(`${cell.row},${cell.col}`);
        }
      });
    });
    return cells;
  }
  isOnParallelSegment(x, y) {
    if (!this.parallelSegmentCells || this.parallelSegmentCells.size === 0) {
      return false;
    }
    const cell = this.intersections.getCellFromCanvasPoint(x, y);
    if (!cell) {
      return false;
    }
    return this.parallelSegmentCells.has(`${cell.row},${cell.col}`);
  }
  updateUI() {
    const newCountEl = document.querySelector(`#newCount${this.trainNumber}`);
    if (!newCountEl) return;
    newCountEl.value = this.numCoaches;
    newCountEl.setAttribute("min", _Train.minNumCoaches);
    newCountEl.setAttribute("max", this.trainType === "freight" ? _Train.maxNumFreightWagons : _Train.maxNumCoaches);
    const trainTypeEl = document.querySelector(`#lblTrainType${this.trainNumber}`);
    if (trainTypeEl) {
      trainTypeEl.textContent = this.trainType.toLowerCase() === "passenger" ? "P" : "F";
    }
    const infoContainer = document.querySelector("#infoForTrain");
    if (infoContainer && !infoContainer.querySelector(`div[data-value="${this.trainNumber}"]`)) {
      const infoSpan = document.createElement("div");
      infoSpan.dataset.value = String(this.trainNumber);
      infoSpan.textContent = `T${this.trainNumber}`;
      infoSpan.style = "background-color:" + (this.trainType === "freight" ? "rgba(80,80,80,0.75)" : this.color) + ";cursor:pointer;font-size:1.0em;padding:2px;margin:1px;border:1px solid black;display:inline-block";
      infoContainer.appendChild(infoSpan);
    }
    const stationContainer = document.querySelector("#stationFortrain");
    if (stationContainer && !stationContainer.querySelector(`span[data-value="${this.trainNumber}"]`)) {
      const stationSpan = document.createElement("span");
      stationSpan.dataset.value = String(this.trainNumber);
      stationSpan.dataset.role = "station-train";
      stationSpan.textContent = `T${this.trainNumber}`;
      stationSpan.style = "background-color:" + (this.trainType === "freight" ? "rgba(80,80,80,0.75)" : this.color) + ";cursor:pointer;font-size:1.0em;padding:2px;margin:1px;border:1px solid black;display:inline-block";
      stationContainer.appendChild(stationSpan);
    }
    const flyoverContainer = document.querySelector("#flyoverForTrain");
    if (flyoverContainer && !flyoverContainer.querySelector(`span[data-value="${this.trainNumber}"]`)) {
      const flyoverSpan = document.createElement("span");
      flyoverSpan.dataset.value = String(this.trainNumber);
      flyoverSpan.dataset.role = "flyover-train";
      flyoverSpan.textContent = `T${this.trainNumber}`;
      flyoverSpan.style = "background-color:" + (this.trainType === "freight" ? "rgba(80,80,80,0.75)" : this.color) + ";cursor:pointer;font-size:1.0em;padding:2px;margin:1px;border:1px solid black;display:inline-block";
      flyoverContainer.appendChild(flyoverSpan);
    }
    const tableBody = document.querySelector("#resultsBody");
    if (tableBody) {
      const trainRow = document.querySelector(`#train-row-${this.trainNumber}`);
      if (!trainRow) {
        const row = document.createElement("tr");
        row.style.backgroundColor = this.color;
        row.setAttribute("id", `train-row-${this.trainNumber}`);
        row.setAttribute("onmousemove", `highlightTrainTrack(${this.trainNumber},event)`);
        const trainCell = document.createElement("td");
        trainCell.textContent = `T${this.trainNumber}`;
        const revenueCell = document.createElement("td");
        revenueCell.textContent = "0";
        revenueCell.setAttribute("id", `revenue-cell-${this.trainNumber}`);
        const expensesCell = document.createElement("td");
        expensesCell.textContent = "0";
        expensesCell.setAttribute("id", `expenses-cell-${this.trainNumber}`);
        const profitCell = document.createElement("td");
        profitCell.setAttribute("id", `profit-cell-${this.trainNumber}`);
        profitCell.textContent = "0";
        row.appendChild(trainCell);
        row.appendChild(revenueCell);
        row.appendChild(expensesCell);
        row.appendChild(profitCell);
        tableBody.appendChild(row);
      }
    }
    tableBody.setAttribute("onmouseleave", "clearTempCanvas(event)");
  }
  upgradeEngine() {
    if (this.upgradedEngine) {
      swal("Engine already upgraded", "", "info");
      return;
    }
    this.financials.upgradeEngine(this.getCurrentTimeIndex(), this.trainNumber);
    this.upgradedEngine = true;
    if (this.trainType === "freight") {
      this.speed = 5;
    }
  }
  addCoach(numCoaches = 1) {
    const maxAllowedCoaches = this.trainType === "freight" ? _Train.maxNumFreightWagons : _Train.maxNumCoaches;
    if (this.numCoaches + numCoaches > maxAllowedCoaches) return;
    this.numCoaches += numCoaches;
    if (!this.hasExplicitVisualCoachCap) {
      this.maxVisualCoaches = this.numCoaches;
    }
    this.trainlength = _Train.lengthEngine + (_Train.lengthCoach + 2) * this.numCoaches;
  }
  removeCoach(numCoaches = 1) {
    if (this.numCoaches <= _Train.minNumCoaches) return;
    if (numCoaches <= 0) return;
    if (this.numCoaches - numCoaches >= _Train.minNumCoaches) {
      this.numCoaches -= numCoaches;
      if (!this.hasExplicitVisualCoachCap) {
        this.maxVisualCoaches = this.numCoaches;
      }
      this.trainlength = _Train.lengthEngine + (_Train.lengthCoach + 2) * this.numCoaches;
      const newCountEl = document.querySelector(`#newCount${this.trainNumber}`);
      if (newCountEl) {
        newCountEl.value = this.numCoaches;
      }
    }
  }
  setDysfunctional(state) {
    this.dysfunctional = state;
    if (state) {
      this.awaitingTurnaround = false;
      this.activeIntersections.forEach((intersection, key) => {
        this.clearIntersection(intersection.row, intersection.col);
        this.intersections.updateIntersection(intersection.row, intersection.col, null, this.lane);
      });
    } else {
      this.repairticks = 0;
      this.count = 0;
      this.isReturning = false;
      this.paused = false;
      this.userPaused = false;
      this.awaitingTurnaround = false;
    }
  }
  isUserPaused() {
    return this.userPaused;
  }
  startStop() {
    this.userPaused = !this.userPaused;
  }
  setUserPaused(state) {
    this.userPaused = !!state;
  }
  setLane(lane) {
    const nextLane = Number.isFinite(lane) ? lane : this.lane;
    if (nextLane === this.lane) return;
    this.activeIntersections.forEach((intersection) => {
      this.intersections.updateIntersection(intersection.row, intersection.col, null, this.lane);
    });
    this.lane = nextLane;
    this.activeIntersections.forEach((intersection) => {
      this.intersections.updateIntersection(intersection.row, intersection.col, this.trainNumber, this.lane);
    });
  }
  draw() {
    let currSpeed;
    if (!this.upgradedEngine) {
      const step1 = this.trainType == "passenger" ? 20 - Math.floor(this.speed * 1 / 6) : 20;
      const step2 = this.trainType == "passenger" ? 20 - Math.floor(this.speed * 2 / 6) : 20;
      const step3 = this.trainType == "passenger" ? 20 - Math.floor(this.speed * 3 / 6) : 20;
      const step4 = this.trainType == "passenger" ? 20 - Math.floor(this.speed * 4 / 6) : 20;
      const step5 = this.trainType == "passenger" ? 20 - Math.floor(this.speed * 5 / 6) : 20;
      currSpeed = this.ticks < 50 ? step1 : this.ticks < 150 ? step2 : this.ticks < 250 ? step3 : this.ticks < 350 ? step4 : this.ticks < 450 ? step5 : this.speed;
    } else {
      const step1 = this.trainType == "freight" ? 20 - Math.floor(this.speed * 1 / 6) : 20;
      const step2 = this.trainType == "freight" ? 20 - Math.floor(this.speed * 2 / 6) : 20;
      const step3 = this.trainType == "freight" ? 20 - Math.floor(this.speed * 3 / 6) : 20;
      currSpeed = this.ticks < 50 ? step1 : this.ticks < 150 ? step2 : this.ticks < 250 ? step3 : this.speed;
    }
    if (this.dysfunctional) {
      const healthBar = document.querySelector(`#health${this.trainNumber}`);
      if (this.repairticks % 1e3 == 0) {
        if (healthBar) {
          const width = this.repairticks / this.repairTime * 30;
          healthBar.style.width = `${width}px`;
        }
      }
      this.repairticks++;
      if (this.repairticks >= this.repairTime) {
        this.setDysfunctional(false);
        if (healthBar) {
          healthBar.style.width = `30px`;
        }
      }
      return;
    }
    const d = 4;
    if (!this.userPaused) {
      this.ticks++;
      this.remainingDwellTime--;
    }
    if (this.ticks < this.delayBeforeStart * 100) return;
    this.delayBeforeStart = 0;
    this.dwellPaused = this.remainingDwellTime > 0 ? true : false;
    const countBeforeMove = this.count;
    if (this.ticks % currSpeed == 0 && !this.userPaused && !this.dwellPaused) {
      const previousCount = this.count;
      const distanceStep = 3;
      const nextCount = this.count + distanceStep;
      let distanceMoved = distanceStep;
      if (this.track.totalLength > 0 && nextCount >= this.track.totalLength) {
        distanceMoved = Math.max(0, this.track.totalLength - previousCount);
        this.count = this.track.totalLength;
        this.awaitingTurnaround = true;
      } else {
        this.count = nextCount;
      }
      this.distanceTraveledInTimeUnit += distanceMoved;
    }
    let { x, y, direction, segment } = this.getPosition(0);
    this.x = x;
    this.y = y;
    let atAStation = false;
    const stationNumbers = this.stations.map((st) => st.stationNumber);
    const minStationNumber = stationNumbers.length ? Math.min(...stationNumbers) : 0;
    const startStationLocationKey = `${Math.round(this.stations.find((st) => st.stationNumber === minStationNumber).x)},${Math.round(this.stations.find((st) => st.stationNumber === minStationNumber).y)}`;
    const maxStationNumber = stationNumbers.length ? Math.max(...stationNumbers) : 0;
    const endStationLocationKey = `${Math.round(this.stations.find((st) => st.stationNumber === maxStationNumber).x)},${Math.round(this.stations.find((st) => st.stationNumber === maxStationNumber).y)}`;
    for (const station of this.stations) {
      const stationDistanceFromStart = Number.isFinite(station.distanceFromStart) ? station.distanceFromStart : this.track.getProjectedDistanceForStation(station);
      const stationDistanceInCurrentDirection = this.isReturning ? this.track.totalLength - stationDistanceFromStart : stationDistanceFromStart;
      const isAtStation = Math.abs(x - station.x) < 5 && Math.abs(y - station.y) < 5;
      if (!isAtStation) continue;
      const isTerminalForCurrentDirection = !this.isReturning && station.stationNumber === maxStationNumber || this.isReturning && station.stationNumber === minStationNumber;
      const isTerminalStation = station.stationNumber === minStationNumber || station.stationNumber === maxStationNumber;
      const trainIsReturning = isTerminalForCurrentDirection ? !this.isReturning : this.isReturning;
      if (this.trainType == "passenger") {
        const stationVisitKey = `${Math.round(station.x)},${Math.round(station.y)}`;
        let totalDeboarding = 0;
        let totalBoarding = 0;
        const thisStationKey = `${station.stationNumber}`;
        atAStation = true;
        if (this.lastProcessedStationVisitKey === stationVisitKey) continue;
        this.lastProcessedStationVisitKey = stationVisitKey;
        this.remainingDwellTime = stationVisitKey != startStationLocationKey && stationVisitKey != endStationLocationKey ? station.dwellTime : 0;
        if (isTerminalStation) {
          totalDeboarding = this.passengersOnBoard;
          this.passengerMap.clear();
        } else {
          for (const fromToKey of this.passengerMap.keys()) {
            const [fromKey, toKeyInMap] = fromToKey.split("-");
            if (toKeyInMap === thisStationKey) {
              totalDeboarding += this.passengerMap.get(fromToKey);
              this.passengerMap.delete(fromToKey);
            }
          }
        }
        if (this.shouldLogDebug()) {
          console.log(`[debug train ${this.trainNumber}] station=${station.name} stationNumber=${station.stationNumber} passengerMap=${JSON.stringify(Array.from(this.passengerMap.entries()))}`);
        }
        if (this.shouldLogDebug()) {
          console.log(`[debug train ${this.trainNumber}] totalDeboarding=${totalDeboarding} totalBoarding=${totalBoarding}`);
        }
        const travelPopFrom = this.travelPopulation.travelPopulation.get(`${station.x},${station.y}`)?.population ?? 0;
        for (const nextStation of this.stations) {
          if (!trainIsReturning && nextStation.stationNumber > station.stationNumber || trainIsReturning && nextStation.stationNumber < station.stationNumber) {
            const toKey = `${nextStation.stationNumber}`;
            const travelPopTo = this.travelPopulation.travelPopulation.get(`${nextStation.x},${nextStation.y}`)?.population ?? 0;
            let boarding = Math.ceil(travelPopTo * travelPopFrom * (0.7 + 0.6 * Math.random()) / this.totalTravelPopulation);
            totalBoarding += boarding;
            const routeKey = `${thisStationKey}-${toKey}`;
            this.passengerMap.set(routeKey, boarding);
          }
        }
        const passengerCapacity = this.numCoaches * _Train.coachPassengerCapacity;
        let proportionBoarding = 1;
        let unableToBoard = 0;
        if (totalBoarding + this.passengersOnBoard - totalDeboarding > passengerCapacity) {
          unableToBoard = totalBoarding + this.passengersOnBoard - totalDeboarding - passengerCapacity;
          proportionBoarding = (totalBoarding - unableToBoard) / totalBoarding;
        }
        totalBoarding = Math.floor(totalBoarding * proportionBoarding);
        let ticketPrice = 0;
        let adjustedBoarding = 0;
        let totalAdjustedBoarding = 0;
        let earnings = 0;
        let totalEarnings = 0;
        for (const fromToKey of this.passengerMap.keys()) {
          const [fromKey, toKeyInMap] = fromToKey.split("-");
          if (fromKey === thisStationKey) {
            const currentBoarding = this.passengerMap.get(fromToKey);
            adjustedBoarding = Math.floor(currentBoarding * proportionBoarding);
            totalAdjustedBoarding += adjustedBoarding;
            const toStationObj = this.stations.find((st) => st.stationNumber === parseInt(toKeyInMap));
            const ticketPriceKey1 = `${Math.floor(station.x / 100) + 1},${Math.floor(station.y / 100) + 1}-${Math.floor(toStationObj.x / 100) + 1},${Math.floor(toStationObj.y / 100) + 1}`;
            const ticketPriceKey2 = `${Math.floor(toStationObj.x / 100) + 1},${Math.floor(toStationObj.y / 100) + 1}-${Math.floor(station.x / 100) + 1},${Math.floor(station.y / 100) + 1}`;
            if (_Train.ticketPriceMap.has(ticketPriceKey1)) {
              ticketPrice = _Train.ticketPriceMap.get(ticketPriceKey1);
            } else if (_Train.ticketPriceMap.has(ticketPriceKey2)) {
              ticketPrice = _Train.ticketPriceMap.get(ticketPriceKey2);
            } else {
              ticketPrice = _Train.baseTicketPrice * this.adjustmentForDistance(fromToKey);
              _Train.ticketPriceMap.set(ticketPriceKey1, ticketPrice);
            }
            earnings = Math.floor(ticketPrice * adjustedBoarding);
            totalEarnings += earnings;
            this.passengerMap.set(fromToKey, adjustedBoarding);
          }
        }
        if (this.shouldLogDebug()) {
          console.log(`[debug train ${this.trainNumber}] station=${station.name} stationNumber=${station.stationNumber} beforeOnBoard=${this.passengersOnBoard} totalDeboarding=${totalDeboarding} totalBoarding=${totalBoarding} totalAdjustedBoarding=${totalAdjustedBoarding} totalEarnings=${totalEarnings} passengerCapacity=${passengerCapacity} unableToBoard=${unableToBoard}`);
        }
        this.financials.incrementRevenueFromTickets(this.getCurrentTimeIndex(), this.trainNumber, totalEarnings);
        const prevPassengersOnBoard = this.passengersOnBoard;
        this.passengersOnBoard = this.passengersOnBoard + totalAdjustedBoarding - totalDeboarding;
        const passengerMetrics = {
          deboarding: totalDeboarding,
          boarding: totalAdjustedBoarding,
          onboard: this.passengersOnBoard,
          unableToBoard,
          earnings: totalEarnings
        };
        this.stationVisitContext = {
          trainType: "passenger",
          stationName: station.name,
          isTerminal: isTerminalForCurrentDirection,
          metrics: passengerMetrics
        };
        if (isTerminalForCurrentDirection) {
          this.logStationOperation("arrival", this.stationVisitContext);
        }
      }
      if (this.trainType == "freight") {
        atAStation = true;
        const stationVisitKey = `${Math.round(station.x)},${Math.round(station.y)}`;
        if (this.lastProcessedStationVisitKey === stationVisitKey) continue;
        this.lastProcessedStationVisitKey = stationVisitKey;
        this.remainingDwellTime = station.stationNumber != minStationNumber && station.stationNumber != maxStationNumber ? station.dwellTime : 0;
        let totalRawMaterialDemand = 0;
        const demand = this.rawMaterialDemand.demandAt(station.x, station.y);
        let totalUnloading = 0;
        if (demand > 0) {
          totalUnloading = Math.min(demand, this.rawMaterialOnBoard);
          this.financials.incrementRevenueFromRawMaterial(this.getCurrentTimeIndex(), this.trainNumber, totalUnloading * _Train.freightChargePerUnit);
          this.rawMaterialOnBoard -= totalUnloading;
          this.rawMaterialDemand.decreaseDemand(station.x, station.y, totalUnloading);
        }
        for (const nextStation of this.stations) {
          if (!trainIsReturning && nextStation.stationNumber > station.stationNumber || trainIsReturning && nextStation.stationNumber < station.stationNumber) {
            const demand2 = this.rawMaterialDemand.demandAt(nextStation.x, nextStation.y);
            totalRawMaterialDemand += demand2;
          }
        }
        let rawMaterialAvailable = this.rawMaterialSupply.availableAt(station.x, station.y);
        let capacity = this.numCoaches * _Train.freightWagonCapacity;
        let availableCapacity = capacity - (this.rawMaterialOnBoard ?? 0);
        let rawMaterialLoaded = Math.min(totalRawMaterialDemand - this.rawMaterialOnBoard, rawMaterialAvailable, availableCapacity);
        if (rawMaterialLoaded > 0) {
          this.rawMaterialOnBoard += rawMaterialLoaded;
          this.rawMaterialSupply.decreaseRawMaterial(station.x, station.y, rawMaterialLoaded);
        }
        if (this.shouldLogDebug()) {
          console.log(`[debug freight T${this.trainNumber}] S=${station.name} SN=${station.stationNumber} Available=${rawMaterialAvailable} beforeOnBoard=${this.rawMaterialOnBoard - rawMaterialLoaded} totalUnloading=${totalUnloading} rawMaterialLoaded=${rawMaterialLoaded} afterOnBoard=${this.rawMaterialOnBoard} earnings=${totalUnloading * _Train.freightChargePerUnit} demand=${totalRawMaterialDemand}`);
        }
        const freightMetrics = {
          unloading: totalUnloading,
          rawMaterialLoaded,
          rawMaterialOnBoard: this.rawMaterialOnBoard,
          unableToLoad: totalRawMaterialDemand - this.rawMaterialOnBoard,
          earnings: totalUnloading * _Train.freightChargePerUnit
        };
        this.stationVisitContext = {
          trainType: "freight",
          stationName: station.name,
          isTerminal: isTerminalForCurrentDirection,
          metrics: freightMetrics
        };
        if (isTerminalForCurrentDirection) {
          this.logStationOperation("arrival", this.stationVisitContext);
        }
      }
    }
    if (!atAStation) {
      if (this.stationVisitContext) {
        this.logStationOperation("departure", this.stationVisitContext);
        this.stationVisitContext = null;
      }
      this.lastProcessedStationVisitKey = null;
    }
    if (this.awaitingTurnaround && atAStation) {
      this.count = 0;
      this.ticks = 0;
      this.isReturning = !this.isReturning;
      this.tripNumber++;
      this.lastSmokeEmitTick = 0;
      this.awaitingTurnaround = false;
    }
    const heading = Number.isFinite(direction) ? direction : 0;
    const laneToOffsetMultiplier = [0, -1, 1];
    const normalizedLane = Number.isFinite(this.lane) ? (this.lane % 3 + 3) % 3 : 0;
    const laneOffsetMagnitude = laneToOffsetMultiplier[normalizedLane] * _Train.widthEngine * 0.3;
    const engineOffsetMagnitude = this.isOnParallelSegment(x, y) ? laneOffsetMagnitude : 0;
    const laneOffsetX = -Math.sin(heading) * engineOffsetMagnitude;
    const laneOffsetY = Math.cos(heading) * engineOffsetMagnitude;
    const engineDrawX = x + laneOffsetX;
    const engineDrawY = y + laneOffsetY;
    this.ctx.save();
    this.ctx.fillStyle = this.color;
    this.ctx.translate(engineDrawX, engineDrawY);
    this.ctx.rotate(heading);
    this.ctx.translate(-1 * _Train.lengthEngine * 0.5, -1 * _Train.widthEngine * 0.5);
    this.drawEngine(0, 0);
    this.ctx.restore();
    const occupiedIntersections = /* @__PURE__ */ new Map();
    this.setIntersection(occupiedIntersections, x, y);
    const getCoachGap = (coachIndex, spacingScale = 1) => {
      const firstCoachGap = (_Train.lengthEngine + _Train.lengthCoach + 2 * d) * 0.5;
      return firstCoachGap + (_Train.lengthCoach + d) * coachIndex * spacingScale;
    };
    for (let coachNum = 0; coachNum < this.numCoaches; coachNum++) {
      const gap = getCoachGap(coachNum);
      const { x: x2, y: y2 } = this.getPosition(-1 * gap);
      this.setIntersection(occupiedIntersections, x2, y2);
    }
    const visibleCoachCount = this.numCoaches;
    const simulatedCoachRangeMax = Math.max(0, this.numCoaches - 1);
    let remainingPayload = this.trainType === "passenger" ? this.passengersOnBoard : this.rawMaterialOnBoard;
    let payload = 0;
    for (let visualIndex = 0; visualIndex < visibleCoachCount; visualIndex++) {
      const simulatedCoachIndex = visibleCoachCount === 1 ? 0 : Math.round(visualIndex / (visibleCoachCount - 1) * simulatedCoachRangeMax);
      const gap = getCoachGap(simulatedCoachIndex, this.visualLengthScale);
      const { x: x2, y: y2, direction: direction2 } = this.getPosition(-1 * gap);
      const coachHeading = Number.isFinite(direction2) ? direction2 : 0;
      const coachOffsetMagnitude = this.isOnParallelSegment(x2, y2) ? laneOffsetMagnitude : 0;
      const coachOffsetX = -Math.sin(coachHeading) * coachOffsetMagnitude;
      const coachOffsetY = Math.cos(coachHeading) * coachOffsetMagnitude;
      const coachDrawX = x2 + coachOffsetX;
      const coachDrawY = y2 + coachOffsetY;
      this.ctx.save();
      this.ctx.fillStyle = this.color;
      this.ctx.translate(coachDrawX, coachDrawY);
      this.ctx.rotate(coachHeading);
      this.ctx.translate(-10, -1 * _Train.widthCoach * 0.5);
      if (this.trainType === "freight") {
        payload = Math.min(remainingPayload, _Train.freightWagonCapacity);
        remainingPayload -= payload;
      } else if (this.trainType === "passenger") {
        payload = Math.min(remainingPayload, _Train.coachPassengerCapacity);
        remainingPayload -= payload;
      }
      this.drawCoach(payload);
      this.ctx.restore();
    }
    this.maybeEmitSmoke(engineDrawX, engineDrawY, heading, currSpeed);
    this.drawSmokePuffs();
    this.syncIntersections(occupiedIntersections);
    return { x, y, width: _Train.lengthEngine + _Train.lengthCoach * this.numCoaches + 5 };
  }
  maybeEmitSmoke(engineX, engineY, heading, currSpeed) {
    if (this.userPaused || this.dwellPaused) {
      return;
    }
    const smokeSetting = this.normalizeSmokeSetting(this.smokeSetting);
    if (smokeSetting === "off") {
      return;
    }
    const emitScale = smokeSetting === "low" ? 1.6 : 0.7;
    const emitEveryTicks = this.trainType === "passenger" ? 10 : 40;
    if (this.ticks - this.lastSmokeEmitTick < emitEveryTicks) {
      return;
    }
    this.lastSmokeEmitTick = this.ticks;
    const chimneyRadius = _Train.widthEngine * _Train.chimney_r / 100;
    const frontOffset = -0.5 * _Train.lengthEngine * 0.42 + chimneyRadius * 0.9;
    const chimneyX = engineX + Math.cos(heading) * frontOffset;
    const chimneyY = engineY + Math.sin(heading) * frontOffset;
    const lateralJitterX = -Math.sin(heading) * ((Math.random() - 0.5) * 1.6);
    const lateralJitterY = Math.cos(heading) * ((Math.random() - 0.5) * 1.6);
    const puffCount = smokeSetting === "low" ? 1 : 2;
    for (let i = 0; i < puffCount; i++) {
      const puff = {
        x: chimneyX + lateralJitterX + -Math.sin(heading) * (i * 1.4),
        y: chimneyY + lateralJitterY + Math.cos(heading) * (i * 1.4),
        r: 3.5 + Math.random() * 3.1,
        grow: 0.16 + Math.random() * 0.12,
        vx: -Math.cos(heading) * (0.1 + Math.random() * 0.08) + (Math.random() - 0.5) * 0.07,
        vy: -Math.sin(heading) * (0.1 + Math.random() * 0.08) + (Math.random() - 0.5) * 0.07 - 0.06,
        life: 85 + Math.floor(Math.random() * 55),
        maxLife: 85 + Math.floor(Math.random() * 55),
        alphaMax: smokeSetting === "low" ? 0.24 : 0.5
      };
      this.smokePuffs.push(puff);
    }
    const maxPuffs = smokeSetting === "low" ? 24 : _Train.maxSmokePuffs;
    if (this.smokePuffs.length > maxPuffs) {
      this.smokePuffs.splice(0, this.smokePuffs.length - maxPuffs);
    }
  }
  drawSmokePuffs() {
    if (!this.smokePuffs.length) {
      return;
    }
    this.ctx.save();
    for (let i = this.smokePuffs.length - 1; i >= 0; i--) {
      const puff = this.smokePuffs[i];
      puff.x += puff.vx;
      puff.y += puff.vy;
      puff.r += puff.grow;
      puff.life -= 1;
      const t = puff.maxLife > 0 ? puff.life / puff.maxLife : 0;
      const alphaLimit = Number.isFinite(puff.alphaMax) ? puff.alphaMax : 0.28;
      const alpha2 = Math.max(0, Math.min(alphaLimit, t * alphaLimit));
      if (puff.life <= 0 || alpha2 <= 0) {
        this.smokePuffs.splice(i, 1);
        continue;
      }
      this.ctx.beginPath();
      this.ctx.fillStyle = `rgba(160,160,160,${alpha2})`;
      this.ctx.arc(puff.x, puff.y, puff.r, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }
  drawEngine(x, y) {
    let chimneyRadius = _Train.widthEngine * _Train.chimney_r / 100;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, _Train.lengthEngine * 3 / 4, _Train.widthEngine);
    this.ctx.fill();
    this.ctx.closePath();
    this.ctx.beginPath();
    this.ctx.moveTo(x + _Train.lengthEngine * 0.5 + chimneyRadius, y + _Train.widthEngine * 0.5);
    this.ctx.arc(x + _Train.lengthEngine * 0.5 + chimneyRadius, y + _Train.widthEngine * 0.5, chimneyRadius, 0, 2 * Math.PI);
    this.ctx.fillStyle = _Train.smokeColor;
    this.ctx.fill();
    this.ctx.closePath();
    this.ctx.beginPath();
    this.ctx.moveTo(x + _Train.lengthEngine * 3 / 4, y);
    this.ctx.quadraticCurveTo(x + _Train.lengthEngine, y + _Train.widthEngine * 0.5, x + _Train.lengthEngine * 3 / 4, y + _Train.widthEngine);
    this.ctx.fillStyle = this.color;
    this.ctx.fill();
    this.ctx.closePath();
    this.ctx.beginPath();
    this.ctx.rect(x, y, _Train.lengthEngine / 4, _Train.widthEngine);
    this.ctx.fillStyle = `#000`;
    this.ctx.fill();
    this.ctx.closePath();
    this.ctx.restore();
  }
  drawCoach(payload) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.fillStyle = "#000";
    if (this.trainType === "passenger") {
      this.ctx.fillRect(_Train.lengthCoach, 3, 4, _Train.widthCoach - 6);
    } else if (this.trainType === "freight") {
      const couplingWidth = 2;
      const couplingHeight = 2;
      const couplingOffset = 2;
      this.ctx.fillRect(_Train.lengthCoach, couplingOffset, couplingWidth, couplingHeight);
      this.ctx.fillRect(_Train.lengthCoach, _Train.widthCoach - couplingOffset - couplingHeight, couplingWidth, couplingHeight);
    }
    this.ctx.closePath();
    this.ctx.beginPath();
    const gradient = this.ctx.createLinearGradient(0, 0, _Train.lengthCoach, _Train.widthCoach);
    if (this.trainType === "passenger") {
      gradient.addColorStop(0, _Train.coachColor);
      gradient.addColorStop(1, "#8888ff");
    } else if (this.trainType === "freight") {
      gradient.addColorStop(0, _Train.freightWagonColor);
      gradient.addColorStop(1, "#ff8888");
    }
    this.ctx.fillStyle = gradient;
    this.ctx.strokeStyle = "#333";
    this.ctx.rect(0, 0, _Train.lengthCoach, _Train.widthCoach);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.closePath();
    this.ctx.restore();
    if (this.trainType === "passenger" && payload < _Train.coachPassengerCapacity || this.trainType === "freight" && payload < _Train.freightWagonCapacity) {
      const radius = this.trainType === "passenger" ? (_Train.coachPassengerCapacity - payload) * 5 / _Train.coachPassengerCapacity : (_Train.freightWagonCapacity - payload) * 5 / _Train.freightWagonCapacity;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.fillStyle = "#ffffff";
      this.ctx.arc(_Train.lengthCoach * 0.5, _Train.widthCoach * 0.5, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.closePath();
      this.ctx.restore();
    }
  }
  getPosition(offset) {
    const distance = this.count + offset;
    return this.track.getPoseAtDistance(distance, this.isReturning);
  }
  setIntersection(intersectionsMap, x, y) {
    if (x < this.intersections.offsetX || y < this.intersections.offsetY) return;
    const intersection = this.intersections.getCellAtPosition(x, y, _Train.intersectionDist);
    if (!intersection) return;
    const key = `${intersection.row},${intersection.col}`;
    intersectionsMap.set(key, intersection);
  }
  syncIntersections(nextIntersections) {
    let hasNewIntersection = false;
    nextIntersections.forEach((intersection, key) => {
      if (!this.activeIntersections.has(key)) {
        this.displayIntersection(intersection.row, intersection.col);
        this.intersections.updateIntersection(intersection.row, intersection.col, this.trainNumber, this.lane);
        hasNewIntersection = true;
      }
    });
    this.activeIntersections.forEach((intersection, key) => {
      if (!nextIntersections.has(key)) {
        this.clearIntersection(intersection.row, intersection.col);
        this.intersections.updateIntersection(intersection.row, intersection.col, null, this.lane);
      }
    });
    if (hasNewIntersection) {
    }
    this.activeIntersections = nextIntersections;
  }
  displayIntersection(row, col) {
  }
  clearIntersection(row, col) {
    const { x, y } = this.intersections.getCanvasPoint(row, col);
    this.ctxTemp.clearRect(x - 5, y - 5, 10, 10);
  }
  addStation(station) {
    const duplicateStation = this.stations.find((st) => Math.abs(st.x - station.x) < 1 && Math.abs(st.y - station.y) < 1);
    if (duplicateStation) {
      return;
    }
    this.track.addStation(station);
    this.stations = this.track.getStations();
    this.lastProcessedStationVisitKey = null;
    this.stationVisitContext = null;
    if (this.trainType === "passenger") {
      this.passengerMap.clear();
    }
  }
  deleteStation(station) {
    this.track.deleteStation(station);
    this.stations = this.track.getStations();
    this.lastProcessedStationVisitKey = null;
    this.stationVisitContext = null;
    if (this.trainType === "passenger") {
      this.passengerMap.clear();
    }
  }
  getNumStations() {
    return this.stations.length;
  }
  consumeDistanceTraveledInTimeUnit() {
    const distance = this.distanceTraveledInTimeUnit;
    this.distanceTraveledInTimeUnit = 0;
    return distance;
  }
  adjustmentForDistance(fromToKey) {
    const [fromStation, toStation] = fromToKey.split("-").map(Number);
    const fromStationObj = this.stations.find((st) => st.stationNumber === fromStation);
    const toStationObj = this.stations.find((st) => st.stationNumber === toStation);
    if (!fromStationObj || !toStationObj) {
      return 1;
    }
    const fromCoords = [fromStationObj.x, fromStationObj.y];
    const toCoords = [toStationObj.x, toStationObj.y];
    const distance = Math.sqrt(Math.pow(toCoords[0] - fromCoords[0], 2) + Math.pow(toCoords[1] - fromCoords[1], 2));
    const distanceUnits = distance / 100;
    const adjustmentFactor = 1 + 0.08 * distanceUnits + 0.01 * distanceUnits * distanceUnits;
    return adjustmentFactor;
  }
  getNumCoachesOrFreightWagons() {
    return this.numCoaches;
  }
  extendTrain(positionsForExtendTrain) {
    const { track, stationLocation } = this.track.extendTrack(positionsForExtendTrain);
    this.track = track;
    this.parallelSegmentCells = this.buildParallelSegmentCellSet();
    return stationLocation;
  }
  updateInfoOnTrainOperations(typeOfTrain) {
    const div = document.getElementById(`infotrainoperations${this.trainNumber}`);
    const currentTimeIndex = this.getCurrentTimeIndex();
    if (div) {
      div.replaceChildren();
      const title = document.createElement("div");
      const typeLabel = typeOfTrain === "passenger" ? "Passenger" : "Freight";
      title.textContent = `Train T${this.trainNumber} - ${typeLabel}`;
      title.style = "font-weight:700;margin:0 0 8px 0;";
      div.appendChild(title);
      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      const th1 = document.createElement("th");
      th1.textContent = "Time";
      const th2 = document.createElement("th");
      th2.textContent = "Trip#";
      const th3 = document.createElement("th");
      th3.textContent = "Station";
      const th4 = document.createElement("th");
      th4.textContent = "Event";
      const th5 = document.createElement("th");
      th5.textContent = typeOfTrain === "passenger" ? "DeBoarding" : "Unloading";
      const th6 = document.createElement("th");
      th6.textContent = typeOfTrain === "passenger" ? "Boarding" : "Loading";
      const th7 = document.createElement("th");
      th7.textContent = typeOfTrain === "passenger" ? "Onboard" : "Onboard";
      const th8 = document.createElement("th");
      th8.textContent = typeOfTrain === "passenger" ? "Unable to Board" : "Unable to Load";
      const th9 = document.createElement("th");
      th9.textContent = "Earnings";
      headerRow.appendChild(th1);
      headerRow.appendChild(th2);
      headerRow.appendChild(th3);
      headerRow.appendChild(th4);
      headerRow.appendChild(th5);
      headerRow.appendChild(th6);
      headerRow.appendChild(th7);
      headerRow.appendChild(th8);
      headerRow.appendChild(th9);
      headerRow.style.backgroundColor = this.color;
      thead.appendChild(headerRow);
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      const trainEntries = this.trainInfo.getTrainInfoForTrainAndTimeIndex(this.trainNumber, currentTimeIndex) ?? [];
      const startIndex = Math.max(0, trainEntries.length - _Train.MAX_RENDERED_OPERATION_ROWS);
      const visibleEntries = trainEntries.slice(startIndex);
      visibleEntries.forEach((obj) => {
        const row = document.createElement("tr");
        const td1 = document.createElement("td");
        td1.textContent = currentTimeIndex;
        const td2 = document.createElement("td");
        td2.textContent = obj.tripNumber;
        const td3 = document.createElement("td");
        td3.textContent = obj.stationName;
        const td4 = document.createElement("td");
        td4.textContent = obj.eventType ?? (obj.stationName?.includes("(arrival)") ? "arrival" : obj.stationName?.includes("(departure)") ? "departure" : "");
        const td5 = document.createElement("td");
        td5.textContent = typeOfTrain === "passenger" ? obj.deboarding : obj.unloading;
        const td6 = document.createElement("td");
        td6.textContent = typeOfTrain === "passenger" ? obj.boarding : obj.rawMaterialLoaded;
        const td7 = document.createElement("td");
        td7.textContent = typeOfTrain === "passenger" ? obj.onboard : obj.rawMaterialOnBoard;
        const td8 = document.createElement("td");
        td8.textContent = typeOfTrain === "passenger" ? obj.unableToBoard : obj.unableToLoad;
        const td9 = document.createElement("td");
        td9.textContent = Math.floor(obj.earnings / 1e3) + "K";
        row.appendChild(td1);
        row.appendChild(td2);
        row.appendChild(td3);
        row.appendChild(td4);
        row.appendChild(td5);
        row.appendChild(td6);
        row.appendChild(td7);
        row.appendChild(td8);
        row.appendChild(td9);
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      div.appendChild(table);
    }
  }
  logStationOperation(eventType, visitContext) {
    if (!visitContext) return;
    const { trainType, stationName, isTerminal, metrics } = visitContext;
    const eventMetrics = { ...metrics };
    if (trainType === "freight" && isTerminal && eventType === "departure") {
      eventMetrics.unloading = 0;
      eventMetrics.earnings = 0;
    }
    if (trainType === "passenger" && isTerminal && eventType === "departure") {
      eventMetrics.deboarding = 0;
    }
    if (trainType === "passenger" && isTerminal && eventType === "arrival") {
      eventMetrics.boarding = 0;
      eventMetrics.earnings = 0;
      eventMetrics.onboard = 0;
    }
    this.trainInfo.setTrainInfo(this.trainNumber, this.getCurrentTimeIndex(), {
      tripNumber: this.tripNumber,
      stationName,
      eventType,
      ...eventMetrics
    });
    this.updateInfoOnTrainOperations(trainType);
  }
  getAllGridLocations() {
    const allLocationsOnGrid = this.track.getAllLocationsOnGrid();
    const stationLocations = this.track.stations.getAllStations();
    return allLocationsOnGrid.filter((loc) => !stationLocations.some((station) => station.x === loc.x && station.y === loc.y));
  }
};

// Stations.js
var Stations = class {
  constructor() {
    this.stations = [];
  }
  reindexByDistance() {
    const totalStations = this.stations.length;
    this.stations.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
    this.stations.forEach((station, index) => {
      station.stationNumber = index + 1;
      station.totalStations = totalStations;
    });
  }
  addStation(station) {
    this.stations.push(station);
    this.reindexByDistance();
  }
  deleteStation(station) {
    const index = this.stations.findIndex((item) => item === station);
    if (index !== -1) {
      this.stations.splice(index, 1);
      this.reindexByDistance();
    }
  }
  getAllStations() {
    return this.stations;
  }
  getRemovableStations() {
    if (this.stations.length <= 2) {
      return [];
    }
    return this.stations.slice(1, this.stations.length - 1);
  }
  getStationAt(x, y) {
    return this.stations.find((station) => station.x === x && station.y === y);
  }
};

// Track.js
var Track = class {
  static getTrackLength(positions) {
    let length = 0;
    for (let i = 1; i < positions.length; i++) {
      const dx = positions[i].x - positions[i - 1].x;
      const dy = positions[i].y - positions[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }
  constructor(ctxTracks2, positions, trainName, gridSize2 = 100, overlapMatches = []) {
    this.positions = positions;
    this.newPositions = [];
    this.segments = [];
    this.returnSegments = [];
    this.totalLength = 0;
    this.ctxTracks = ctxTracks2;
    this.trainName = trainName;
    this.gridSize = gridSize2;
    this.stations = new Stations();
    this.overlapMatches = overlapMatches;
    this.possibleFlyoverLocations = [];
    this.updatePositions();
    this.drawUsingNewPositions();
    this.updateSegmentsFromNewPositions();
    this.updatePossibleFlyoverLocations();
  }
  extendTrack(positionsForExtendTrain) {
    const firstPosition = this.positions[0];
    const lastPosition = this.positions[this.positions.length - 1];
    const firstExtendPosition = positionsForExtendTrain[0].x == firstPosition.x && positionsForExtendTrain[0].y == firstPosition.y;
    const lastExtendPosition = positionsForExtendTrain[0].x == lastPosition.x && positionsForExtendTrain[0].y == lastPosition.y;
    const stationRequiredAt = positionsForExtendTrain[positionsForExtendTrain.length - 1];
    if (!firstExtendPosition && !lastExtendPosition) {
      console.error("Invalid track extension: first position of extension does not match either end of the track.");
      return this;
    }
    if (firstExtendPosition) {
      positionsForExtendTrain.reverse();
      this.positions = [...positionsForExtendTrain, ...this.positions.slice(1)];
    } else if (lastExtendPosition) {
      this.positions = [...this.positions, ...positionsForExtendTrain.slice(1)];
    }
    this.newPositions = [];
    this.segments = [];
    this.returnSegments = [];
    this.updatePositions();
    this.drawUsingNewPositions();
    this.updateSegmentsFromNewPositions();
    this.updatePossibleFlyoverLocations();
    this.recalculateAllStationDistances();
    return { track: this, stationLocation: stationRequiredAt };
  }
  getStations() {
    return this.stations.getAllStations();
  }
  getRemovableStations() {
    return this.stations.getRemovableStations();
  }
  getProjectedDistanceForStation(station) {
    let nearestDistance = 0;
    let nearestSquaredDistance = Number.POSITIVE_INFINITY;
    for (const seg of this.segments) {
      const vx = seg.dx;
      const vy = seg.dy;
      const wx = station.x - seg.startx;
      const wy = station.y - seg.starty;
      const vv = vx * vx + vy * vy;
      if (vv === 0) continue;
      const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / vv));
      const projX = seg.startx + t * vx;
      const projY = seg.starty + t * vy;
      const dx = station.x - projX;
      const dy = station.y - projY;
      const squaredDistance = dx * dx + dy * dy;
      if (squaredDistance < nearestSquaredDistance) {
        nearestSquaredDistance = squaredDistance;
        nearestDistance = seg.startDistance + t * seg.length;
      }
    }
    return nearestDistance;
  }
  recalculateAllStationDistances() {
    const stations = this.stations.getAllStations();
    stations.forEach((station) => {
      station.distanceFromStart = this.getProjectedDistanceForStation(station);
    });
    this.stations.reindexByDistance();
  }
  addStation(station) {
    station.distanceFromStart = this.getProjectedDistanceForStation(station);
    this.stations.addStation(station);
    station.draw();
    this.recalculateAllStationDistances();
  }
  deleteStation(station) {
    this.stations.deleteStation(station);
    this.recalculateAllStationDistances();
  }
  delete(position) {
    const index = this.positions.findIndex((item) => item.x == position.x && item.y == position.y);
    this.positions.splice(index, 1);
    this.draw();
    this.updateSegmentsFromNewPositions();
    this.recalculateAllStationDistances();
  }
  display() {
  }
  updatePositions() {
    const tr = 100;
    const pushIfNotLast = (point) => {
      if (!point) return;
      const lastPoint = this.newPositions[this.newPositions.length - 1];
      if (lastPoint && lastPoint.x === point.x && lastPoint.y === point.y) return;
      this.newPositions.push(point);
    };
    pushIfNotLast(this.positions[0]);
    pushIfNotLast(this.positions[1]);
    let pp, p, c;
    for (let i = 2; i < this.positions.length; i++) {
      pp = this.positions[i - 2];
      p = this.positions[i - 1];
      c = this.positions[i];
      if (pp.x == p.x && p.x == c.x || pp.y == p.y && p.y == c.y) {
        pushIfNotLast(this.positions[i]);
        continue;
      }
      this.newPositions.pop();
      const p0 = { x: p.x, y: p.y };
      const p3 = { x: p.x, y: p.y };
      let n = 10;
      let deltax = new Array(n).fill(0);
      let deltay = new Array(n).fill(0);
      let theta = Math.PI / (2 * (n + 1));
      if (pp.x < p.x && p.x == c.x && pp.y == p.y) {
        p0.x -= tr;
        if (p.y < c.y) {
          for (let i2 = 0; i2 < n; i2++) {
            deltax[i2] = -tr * (1 - Math.sin(theta * (i2 + 1)));
            deltay[i2] = tr * (1 - Math.cos(theta * (i2 + 1)));
          }
          p3.y += tr;
        }
        if (p.y > c.y) {
          for (let i2 = 0; i2 < n; i2++) {
            deltax[i2] = -tr * (1 - Math.sin(theta * (i2 + 1)));
            deltay[i2] = -tr * (1 - Math.cos(theta * (i2 + 1)));
          }
          p3.y -= tr;
        }
      }
      if (pp.x > p.x && p.x == c.x && pp.y == p.y) {
        p0.x += tr;
        if (p.y < c.y) {
          for (let i2 = 0; i2 < n; i2++) {
            deltax[i2] = tr * (1 - Math.sin(theta * (i2 + 1)));
            deltay[i2] = tr * (1 - Math.cos(theta * (i2 + 1)));
          }
          p3.y += tr;
        }
        if (p.y > c.y) {
          for (let i2 = 0; i2 < n; i2++) {
            deltax[i2] = tr * (1 - Math.sin(theta * (i2 + 1)));
            deltay[i2] = -tr * (1 - Math.cos(theta * (i2 + 1)));
          }
          p3.y -= tr;
        }
      }
      if (pp.y > p.y && p.y == c.y && pp.x == p.x) {
        p0.y += tr;
        if (p.x > c.x) {
          for (let i2 = 0; i2 < n; i2++) {
            deltax[i2] = -tr * (1 - Math.cos(theta * (i2 + 1)));
            deltay[i2] = tr * (1 - Math.sin(theta * (i2 + 1)));
          }
          p3.x -= tr;
        }
        if (p.x < c.x) {
          for (let i2 = 0; i2 < n; i2++) {
            deltax[i2] = tr * (1 - Math.cos(theta * (i2 + 1)));
            deltay[i2] = tr * (1 - Math.sin(theta * (i2 + 1)));
          }
          p3.x += tr;
        }
      }
      if (pp.y < p.y && p.y == c.y && pp.x == p.x) {
        p0.y -= tr;
        if (p.x > c.x) {
          for (let i2 = 0; i2 < n; i2++) {
            deltax[i2] = -tr * (1 - Math.cos(theta * (i2 + 1)));
            deltay[i2] = -tr * (1 - Math.sin(theta * (i2 + 1)));
          }
          p3.x -= tr;
        }
        if (p.x < c.x) {
          for (let i2 = 0; i2 < n; i2++) {
            deltax[i2] = tr * (1 - Math.cos(theta * (i2 + 1)));
            deltay[i2] = -tr * (1 - Math.sin(theta * (i2 + 1)));
          }
          p3.x += tr;
        }
      }
      pushIfNotLast(p0);
      for (let i2 = 0; i2 < n; i2++) {
        const newP = { x: p.x + deltax[i2], y: p.y + deltay[i2] };
        pushIfNotLast(newP);
      }
      pushIfNotLast(p3);
      pushIfNotLast(c);
    }
  }
  buildSegments(positions) {
    const segments = [];
    let distanceFromStart = 0;
    for (let i = 0; i < positions.length - 1; i++) {
      const start = positions[i];
      const end = positions[i + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) continue;
      const direction = Math.atan2(dy, dx);
      const endDistance = distanceFromStart + length;
      segments.push({
        startDistance: distanceFromStart,
        endDistance,
        distanceFromStart,
        length,
        startx: start.x,
        starty: start.y,
        endx: end.x,
        endy: end.y,
        dx,
        dy,
        unitX: dx / length,
        unitY: dy / length,
        direction
      });
      distanceFromStart = endDistance;
    }
    return {
      segments,
      totalLength: distanceFromStart
    };
  }
  updateSegmentsFromNewPositions() {
    const forwardPath = this.buildSegments(this.newPositions);
    const returnPath = this.buildSegments([...this.newPositions].reverse());
    this.segments = forwardPath.segments;
    this.returnSegments = returnPath.segments;
    this.totalLength = forwardPath.totalLength;
  }
  updatePossibleFlyoverLocations() {
    this.possibleFlyoverLocations = [];
    for (let i = 1; i < this.newPositions.length; i++) {
      const prev = this.newPositions[i - 1];
      const current = this.newPositions[i];
      if (prev.x !== current.x && prev.y !== current.y) {
        continue;
      } else {
        if (prev.x === current.x) {
          for (let n = 0; n <= Math.abs(current.y - prev.y) / this.gridSize; n++) {
            this.possibleFlyoverLocations.push({ x: current.x, y: current.y + n * this.gridSize * Math.sign(prev.y - current.y) });
          }
        }
        if (prev.y === current.y) {
          for (let n = 0; n <= Math.abs(current.x - prev.x) / this.gridSize; n++) {
            this.possibleFlyoverLocations.push({ x: current.x + n * this.gridSize * Math.sign(prev.x - current.x), y: current.y });
          }
        }
      }
    }
    return this.possibleFlyoverLocations;
  }
  getPoseAtDistance(distance, useReturnSegments = false) {
    const activeSegments = useReturnSegments ? this.returnSegments : this.segments;
    if (activeSegments.length === 0) {
      return {
        x: -1,
        y: -1,
        direction: void 0,
        segment: null
      };
    }
    const clampedDistance = Math.max(0, Math.min(distance, this.totalLength));
    const segment = activeSegments.find((seg) => clampedDistance <= seg.endDistance) || activeSegments[activeSegments.length - 1];
    const distanceIntoSegment = clampedDistance - segment.startDistance;
    return {
      x: segment.startx + segment.unitX * distanceIntoSegment,
      y: segment.starty + segment.unitY * distanceIntoSegment,
      direction: segment.direction,
      segment
    };
  }
  draw(ctx2 = this.ctxTracks, color = "rgb(0,0,250)", lineWidth = 1) {
    ctx2.save();
    ctx2.strokeStyle = color;
    ctx2.lineWidth = lineWidth;
    ctx2.beginPath();
    ctx2.moveTo(this.positions[0].x, this.positions[0].y);
    for (let i = 1; i < this.positions.length; i++) {
      ctx2.lineTo(this.positions[i].x, this.positions[i].y);
    }
    ctx2.stroke();
    ctx2.restore();
  }
  drawUsingNewPositions(ctx2 = this.ctxTracks, color = "rgb(255,0,255)", lineWidth = 3) {
    ctx2.save();
    ctx2.strokeStyle = color;
    ctx2.lineWidth = lineWidth;
    ctx2.beginPath();
    ctx2.moveTo(this.newPositions[0].x, this.newPositions[0].y);
    for (let i = 1; i < this.newPositions.length; i++) {
      ctx2.lineTo(this.newPositions[i].x, this.newPositions[i].y);
    }
    ctx2.stroke();
    ctx2.restore();
    ctx2.save();
    ctx2.strokeStyle = "rgb(0,0,50)";
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    ctx2.moveTo(this.newPositions[0].x, this.newPositions[0].y);
    for (let i = 1; i < this.newPositions.length; i++) {
      ctx2.lineTo(this.newPositions[i].x, this.newPositions[i].y);
    }
    ctx2.stroke();
    ctx2.restore();
    this.overlapMatches.forEach((match) => {
      match.commonSegmentsMap.forEach((value, key) => {
        const { startx, starty, endx, endy } = value;
        ctx2.save();
        ctx2.strokeStyle = "rgb(255, 0, 255)";
        ctx2.lineWidth = 6;
        ctx2.beginPath();
        ctx2.moveTo(startx, starty);
        ctx2.lineTo(endx, endy);
        ctx2.stroke();
        ctx2.strokeStyle = "rgb(0,0,50)";
        ctx2.lineWidth = 3;
        ctx2.beginPath();
        ctx2.moveTo(startx, starty);
        ctx2.lineTo(endx, endy);
        ctx2.stroke();
        ctx2.restore();
      });
    });
  }
  getTotalLength() {
    let length = 0;
    const positions = this.positions;
    for (let i = 1; i < positions.length; i++) {
      const dx = positions[i].x - positions[i - 1].x;
      const dy = positions[i].y - positions[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }
  getPossibleStationLocations() {
    const locations = [];
    for (let i = 1; i <= this.newPositions.length - 1; i++) {
      const prev = this.newPositions[i - 1];
      const current = this.newPositions[i];
      if (prev.x === current.x) {
        for (let n = 0; n <= Math.abs(current.y - prev.y) / this.gridSize; n++) {
          const pos = { x: current.x, y: current.y + n * this.gridSize * Math.sign(prev.y - current.y) };
          const hasStation = this.stations.getAllStations().some((station) => station.x === pos.x && station.y === pos.y);
          locations.push({ location: pos, hasStation });
        }
      } else if (prev.y === current.y) {
        for (let n = 0; n <= Math.abs(current.x - prev.x) / this.gridSize; n++) {
          const pos = { x: current.x + n * this.gridSize * Math.sign(prev.x - current.x), y: current.y };
          const hasStation = this.stations.getAllStations().some((station) => station.x === pos.x && station.y === pos.y);
          locations.push({ location: pos, hasStation });
        }
      } else {
        if (Math.abs(current.x - Math.round(current.x / this.gridSize) * this.gridSize) < 1 && Math.abs(current.y - Math.round(current.y / this.gridSize) * this.gridSize) < 1) {
          const x = Math.round(current.x / this.gridSize) * this.gridSize;
          const y = Math.round(current.y / this.gridSize) * this.gridSize;
          const pos = { x, y };
          const hasStation = this.stations.getAllStations().some((station) => station.x === pos.x && station.y === pos.y);
          locations.push({ location: pos, hasStation });
        }
      }
    }
    return locations;
  }
  // getDetailedSegmentsMap(turningCircle = 100) {
  //   const segmentsMap = new Map()
  //   const modifiedPositions = []
  //   let firstx = this.positions[0].x
  //   let firsty = this.positions[0].y
  //   let secondx = this.newPositions[i].x
  //   let secondy = this.newPositions[i].y
  //   let thirdx = this.newPositions[i + 1]?.x
  //   let thirdy = this.newPositions[i + 1]?.y
  //   modifiedPositions.push({ x: firstx, y: firsty })
  //   for (let i = 1; i < this.positions.length; i++) {
  //     secondx = this.newPositions[i].x
  //     secondy = this.newPositions[i].y
  //     thirdx = this.newPositions[i + 1]?.x
  //     thirdy = this.newPositions[i + 1]?.y
  //     if (firstx === secondx && secondx === thirdx) {
  //       // vertical segment will collapse into a single vertical position in the modifiedPositions array
  //     } else if (firsty === secondy && secondy === thirdy) {
  //       // horizontal segment will collapse into a single horizontal position in the modifiedPositions array
  //     } else {
  //       // neither vertical nor horizontal segment, keep the position as is
  //       modifiedPositions.push({ x: secondx, y: secondy })
  //       firstx = secondx
  //       firsty = secondy
  //     }
  //   }
  //   return segmentsMap
  // }
  getAllLocationsOnGrid() {
    return this.possibleFlyoverLocations;
  }
  hasStation(x, y) {
    return this.stations.getRemovableStations().some((station) => station.x === x && station.y === y);
  }
};

// utility.js
var GLOBAL_SPEECH_SETTINGS = {
  rate: 1.2,
  // Slightly faster
  pitch: 1,
  volume: 0.9
};
function speakAsync(text) {
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = GLOBAL_SPEECH_SETTINGS.rate;
    utterance.pitch = GLOBAL_SPEECH_SETTINGS.pitch;
    utterance.volume = GLOBAL_SPEECH_SETTINGS.volume;
    utterance.onend = () => {
      resolve();
    };
    utterance.onerror = (event) => {
      reject(event.error);
    };
    window.speechSynthesis.speak(utterance);
  });
}
function makeDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  element.onmousedown = dragMouseDown;
  function dragMouseDown(e) {
    const interactiveSelector = "input, textarea, select, button, label, i, a";
    if (e.target.closest(interactiveSelector)) {
      return;
    }
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }
  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = element.offsetTop - pos2 + "px";
    element.style.left = element.offsetLeft - pos1 + "px";
  }
  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}
function rowAndColumnName(x, y, gridSize2) {
  const n = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const col = Math.floor(x / gridSize2);
  const row = Math.floor(y / gridSize2);
  const colName = alpha(col);
  const rowName = alpha(row);
  return [rowName, colName];
}
function alpha(index) {
  const n = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return (index >= n.length ? n[Math.floor(index / n.length - 1)] : "") + n[index % n.length];
}
function getDetailedSegmentsMap(positions, turningCircle = 100, gridSize2 = 50) {
  if (!Array.isArray(positions) || positions.length < 2) {
    return /* @__PURE__ */ new Map();
  }
  const segmentsMap = /* @__PURE__ */ new Map();
  const modifiedPositions = [];
  let firstx = positions[0].x;
  let firsty = positions[0].y;
  let secondx, secondy, thirdx, thirdy;
  modifiedPositions.push({ x: firstx, y: firsty });
  for (let i = 1; i < positions.length; i++) {
    secondx = positions[i].x;
    secondy = positions[i].y;
    thirdx = positions[i + 1]?.x;
    thirdy = positions[i + 1]?.y;
    if (firstx === secondx && secondx === thirdx) {
      if (i == positions.length - 1) {
        modifiedPositions.push({ x: secondx, y: secondy });
      }
    } else if (firsty === secondy && secondy === thirdy) {
      if (i == positions.length - 1) {
        modifiedPositions.push({ x: secondx, y: secondy });
      }
    } else {
      modifiedPositions.push({ x: secondx, y: secondy });
      firstx = secondx;
      firsty = secondy;
    }
  }
  let startx, starty, endx, endy;
  let newModifiedPositions = [];
  let n = 0;
  for (let i = 1; i < modifiedPositions.length; i++) {
    startx = modifiedPositions[i - 1].x;
    starty = modifiedPositions[i - 1].y;
    newModifiedPositions.push({ x: startx, y: starty });
    endx = modifiedPositions[i].x;
    endy = modifiedPositions[i].y;
    n = i == modifiedPositions.length - 1 ? 1 : 0;
    if (endx === startx) {
      const dir = endy > starty ? 1 : -1;
      for (let j = 1; j < Math.abs(starty - endy) / gridSize2 + n; j++) {
        newModifiedPositions.push({ x: startx, y: starty + j * gridSize2 * dir, direction: "vertical" });
      }
    }
    if (endy === starty) {
      const dir = endx > startx ? 1 : -1;
      for (let j = 1; j < Math.abs(startx - endx) / gridSize2 + n; j++) {
        newModifiedPositions.push({ x: startx + j * gridSize2 * dir, y: starty, direction: "horizontal" });
      }
    }
    startx = endx;
    starty = endy;
  }
  for (let j = 1; j < newModifiedPositions.length; j++) {
    const prev = newModifiedPositions[j - 1];
    const curr = newModifiedPositions[j];
    if (j > 1 && (prev.direction == "vertical" || prev.direction == "horizontal") && curr.direction == null) {
      prev.skip = true;
      curr.skip = true;
      if (j + 2 < newModifiedPositions.length) {
        const next = newModifiedPositions[j + 1];
        next.skip = true;
      }
    }
  }
  for (let j = 0; j < newModifiedPositions.length - 1; j++) {
    const start = newModifiedPositions[j];
    const end = newModifiedPositions[j + 1];
    if (start.skip || end.skip) {
      continue;
    }
    segmentsMap.set(`${start.x},${start.y}-${end.x},${end.y}`, { startx: start.x, starty: start.y, endx: end.x, endy: end.y });
  }
  return segmentsMap;
}
function getCommonSegmentsMap(positions1, positions2, turningCircle = 100, gridSize2 = 50) {
  const segmentsMap1 = getDetailedSegmentsMap(positions1, turningCircle, gridSize2);
  const segmentsMap2 = getDetailedSegmentsMap(positions2, turningCircle, gridSize2);
  const commonSegmentsMap = /* @__PURE__ */ new Map();
  for (const key of segmentsMap1.keys()) {
    const keyAlternative = key.split("-").reverse().join("-");
    if (segmentsMap2.has(key) || segmentsMap2.has(keyAlternative)) {
      commonSegmentsMap.set(key, segmentsMap1.get(key));
    }
  }
  return commonSegmentsMap;
}
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function createAudioManager(audioSources = {}, { enabled = true, hornDefaults = {}, soundGain = {} } = {}) {
  const sounds = /* @__PURE__ */ new Map();
  let mediaUnlocked = false;
  let audioEnabled = !!enabled;
  let audioContext = null;
  let audioPausedBySystem = false;
  let perSoundGain = { ...soundGain };
  const resolvedHornDefaults = {
    baseFrequency: 280,
    duration: 1.7,
    //0.7
    volume: 0.12,
    detune: 0,
    ...hornDefaults
  };
  const getAudioContext = () => {
    if (audioContext) return audioContext;
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    audioContext = new AudioCtx();
    return audioContext;
  };
  const ensureWebAudioReady = async () => {
    const ctx2 = getAudioContext();
    if (!ctx2) {
      return false;
    }
    if (ctx2.state === "suspended") {
      try {
        await ctx2.resume();
      } catch {
        return false;
      }
    }
    return ctx2.state === "running";
  };
  Object.entries(audioSources).forEach(([key, source]) => {
    if (!key || !source) {
      return;
    }
    const audio = new Audio(source);
    audio.preload = "auto";
    sounds.set(key, audio);
  });
  const unlockAudio = async () => {
    if (!audioEnabled || audioPausedBySystem) {
      return false;
    }
    let unlocked = false;
    if (!mediaUnlocked && sounds.size > 0) {
      const firstAudio = sounds.values().next().value;
      if (firstAudio) {
        try {
          firstAudio.muted = true;
          firstAudio.currentTime = 0;
          await firstAudio.play();
          firstAudio.pause();
          firstAudio.currentTime = 0;
          firstAudio.muted = false;
          mediaUnlocked = true;
          unlocked = true;
        } catch {
        }
      }
    }
    const webAudioReady = await ensureWebAudioReady();
    return unlocked || mediaUnlocked || webAudioReady;
  };
  const playTrainHorn = async ({
    trainNumber = 1,
    baseFrequency = resolvedHornDefaults.baseFrequency,
    duration = resolvedHornDefaults.duration,
    volume = resolvedHornDefaults.volume,
    detune = resolvedHornDefaults.detune
  } = {}) => {
    if (!audioEnabled || audioPausedBySystem) {
      return false;
    }
    const ctx2 = getAudioContext();
    if (!ctx2) {
      return false;
    }
    if (!await ensureWebAudioReady()) {
      return false;
    }
    const safeDuration = Math.min(2.5, Math.max(0.15, Number(duration) || resolvedHornDefaults.duration));
    const safeVolume = Math.min(1, Math.max(0, Number(volume) || resolvedHornDefaults.volume));
    const safeDetune = Math.max(-2400, Math.min(2400, Number(detune) || resolvedHornDefaults.detune));
    const safeTrainNumber = Number.isFinite(trainNumber) ? trainNumber : 1;
    const seed = Math.abs(Math.trunc(safeTrainNumber)) % 13 - 6;
    const trainPitchFactor = Math.pow(2, seed / 36);
    const fundamental = Math.max(80, Math.min(1200, (Number(baseFrequency) || resolvedHornDefaults.baseFrequency) * trainPitchFactor));
    const now = ctx2.currentTime;
    const attack = 0.04;
    const decay = 0.16;
    const release = 0.24;
    const hold = Math.max(0, safeDuration - attack - decay - release);
    const master = ctx2.createGain();
    master.gain.setValueAtTime(1e-4, now);
    master.gain.exponentialRampToValueAtTime(Math.max(1e-4, safeVolume), now + attack);
    master.gain.exponentialRampToValueAtTime(Math.max(1e-4, safeVolume * 0.78), now + attack + decay);
    master.gain.setValueAtTime(Math.max(1e-4, safeVolume * 0.78), now + attack + decay + hold);
    master.gain.exponentialRampToValueAtTime(1e-4, now + safeDuration);
    const bandpass = ctx2.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(fundamental * 2.2, now);
    bandpass.Q.setValueAtTime(0.9, now);
    const osc1 = ctx2.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(fundamental, now);
    osc1.detune.setValueAtTime(safeDetune, now);
    const osc2 = ctx2.createOscillator();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(fundamental * 1.005, now);
    osc2.detune.setValueAtTime(safeDetune + 4, now);
    const lfo = ctx2.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(5.1, now);
    const lfoGain = ctx2.createGain();
    lfoGain.gain.setValueAtTime(10, now);
    osc1.connect(bandpass);
    osc2.connect(bandpass);
    bandpass.connect(master);
    master.connect(ctx2.destination);
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.detune);
    lfoGain.connect(osc2.detune);
    try {
      osc1.start(now);
      osc2.start(now);
      lfo.start(now);
      osc1.stop(now + safeDuration);
      osc2.stop(now + safeDuration);
      lfo.stop(now + safeDuration);
      const cleanupDelay = Math.ceil((safeDuration + 0.05) * 1e3);
      setTimeout(() => {
        try {
          osc1.disconnect();
          osc2.disconnect();
          lfo.disconnect();
          lfoGain.disconnect();
          bandpass.disconnect();
          master.disconnect();
        } catch {
        }
      }, cleanupDelay);
      return true;
    } catch {
      return false;
    }
  };
  const playDistantSteamTrain = async ({
    duration = 8,
    volume = 0.08,
    chuffRate = 2.6,
    pan = 0,
    withWhistle = false
  } = {}) => {
    if (!audioEnabled || audioPausedBySystem) {
      return false;
    }
    const ctx2 = getAudioContext();
    if (!ctx2) {
      return false;
    }
    if (!await ensureWebAudioReady()) {
      return false;
    }
    const safeDuration = Math.min(20, Math.max(2, Number(duration) || 8));
    const safeVolume = Math.min(1, Math.max(0, Number(volume) || 0.08));
    const safeChuffRate = Math.min(5.5, Math.max(0.8, Number(chuffRate) || 2.6));
    const safePan = Math.min(1, Math.max(-1, Number(pan) || 0));
    const now = ctx2.currentTime;
    const master = ctx2.createGain();
    master.gain.setValueAtTime(1e-4, now);
    master.gain.exponentialRampToValueAtTime(Math.max(1e-4, safeVolume), now + 0.8);
    master.gain.setValueAtTime(Math.max(1e-4, safeVolume), now + Math.max(1.2, safeDuration - 1.2));
    master.gain.exponentialRampToValueAtTime(1e-4, now + safeDuration);
    const distanceFilter = ctx2.createBiquadFilter();
    distanceFilter.type = "lowpass";
    distanceFilter.frequency.setValueAtTime(1100, now);
    distanceFilter.frequency.linearRampToValueAtTime(700, now + safeDuration);
    distanceFilter.Q.setValueAtTime(0.8, now);
    const outputNode = typeof ctx2.createStereoPanner === "function" ? ctx2.createStereoPanner() : null;
    if (outputNode) {
      outputNode.pan.setValueAtTime(safePan, now);
    }
    master.connect(distanceFilter);
    if (outputNode) {
      distanceFilter.connect(outputNode);
      outputNode.connect(ctx2.destination);
    } else {
      distanceFilter.connect(ctx2.destination);
    }
    const noiseBufferLength = Math.ceil(ctx2.sampleRate * 2);
    const noiseBuffer = ctx2.createBuffer(1, noiseBufferLength, ctx2.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBufferLength; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const steamNoise = ctx2.createBufferSource();
    steamNoise.buffer = noiseBuffer;
    steamNoise.loop = true;
    const steamBand = ctx2.createBiquadFilter();
    steamBand.type = "bandpass";
    steamBand.frequency.setValueAtTime(320, now);
    steamBand.Q.setValueAtTime(1.2, now);
    const chuffGain = ctx2.createGain();
    chuffGain.gain.setValueAtTime(1e-4, now);
    const chuffInterval = 1 / safeChuffRate;
    for (let t = 0; t < safeDuration; t += chuffInterval) {
      const start = now + t;
      const peak = 0.34 + Math.random() * 0.2;
      chuffGain.gain.setValueAtTime(1e-4, start);
      chuffGain.gain.exponentialRampToValueAtTime(peak, start + 0.03);
      chuffGain.gain.exponentialRampToValueAtTime(1e-4, start + 0.16);
    }
    steamNoise.connect(steamBand);
    steamBand.connect(chuffGain);
    chuffGain.connect(master);
    const rumbleOsc = ctx2.createOscillator();
    rumbleOsc.type = "triangle";
    rumbleOsc.frequency.setValueAtTime(72, now);
    rumbleOsc.frequency.linearRampToValueAtTime(62, now + safeDuration);
    const rumbleGain = ctx2.createGain();
    rumbleGain.gain.setValueAtTime(0.015, now);
    rumbleGain.gain.linearRampToValueAtTime(0.01, now + safeDuration);
    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(master);
    let whistleOsc1 = null;
    let whistleOsc2 = null;
    let whistleGain = null;
    if (withWhistle) {
      const whistleStart = now + Math.min(Math.max(0.9, safeDuration * 0.25), safeDuration - 1.2);
      const whistleDuration = Math.min(1.1, Math.max(0.55, safeDuration * 0.16));
      whistleOsc1 = ctx2.createOscillator();
      whistleOsc1.type = "sine";
      whistleOsc1.frequency.setValueAtTime(430, whistleStart);
      whistleOsc1.frequency.linearRampToValueAtTime(500, whistleStart + whistleDuration);
      whistleOsc2 = ctx2.createOscillator();
      whistleOsc2.type = "triangle";
      whistleOsc2.frequency.setValueAtTime(865, whistleStart);
      whistleOsc2.frequency.linearRampToValueAtTime(995, whistleStart + whistleDuration);
      whistleGain = ctx2.createGain();
      whistleGain.gain.setValueAtTime(1e-4, whistleStart);
      whistleGain.gain.exponentialRampToValueAtTime(0.08, whistleStart + 0.12);
      whistleGain.gain.exponentialRampToValueAtTime(1e-4, whistleStart + whistleDuration);
      whistleOsc1.connect(whistleGain);
      whistleOsc2.connect(whistleGain);
      whistleGain.connect(master);
      whistleOsc1.start(whistleStart);
      whistleOsc2.start(whistleStart);
      whistleOsc1.stop(whistleStart + whistleDuration);
      whistleOsc2.stop(whistleStart + whistleDuration);
    }
    try {
      steamNoise.start(now);
      rumbleOsc.start(now);
      steamNoise.stop(now + safeDuration);
      rumbleOsc.stop(now + safeDuration);
      const cleanupDelay = Math.ceil((safeDuration + 0.2) * 1e3);
      setTimeout(() => {
        try {
          steamNoise.disconnect();
          steamBand.disconnect();
          chuffGain.disconnect();
          rumbleOsc.disconnect();
          rumbleGain.disconnect();
          if (whistleOsc1) whistleOsc1.disconnect();
          if (whistleOsc2) whistleOsc2.disconnect();
          if (whistleGain) whistleGain.disconnect();
          master.disconnect();
          distanceFilter.disconnect();
          if (outputNode) outputNode.disconnect();
        } catch {
        }
      }, cleanupDelay);
      return true;
    } catch {
      return false;
    }
  };
  const safePlay = async (soundKey, { volume = 1, loop = false, restart = true } = {}) => {
    const audio = sounds.get(soundKey);
    if (!audioEnabled || audioPausedBySystem || !audio) {
      return false;
    }
    if (!mediaUnlocked) {
      await unlockAudio();
      if (!mediaUnlocked) {
        return false;
      }
    }
    try {
      const requestedVolume = Number(volume);
      const normalizedVolume = Number.isFinite(requestedVolume) ? Math.min(1, Math.max(0, requestedVolume)) : 1;
      const configuredGain = Number(perSoundGain[soundKey]);
      const normalizedGain = Number.isFinite(configuredGain) ? Math.min(1, Math.max(0, configuredGain)) : 1;
      audio.volume = normalizedVolume * normalizedGain;
      audio.loop = loop;
      if (restart) {
        audio.pause();
        audio.currentTime = 0;
      }
      await audio.play();
      return true;
    } catch {
      return false;
    }
  };
  const setEnabled = (nextEnabled) => {
    audioEnabled = !!nextEnabled;
    if (!audioEnabled) {
      sounds.forEach((audio) => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
        }
      });
    }
    return audioEnabled;
  };
  const pauseAllAudio = async () => {
    audioPausedBySystem = true;
    sounds.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
      }
    });
    if (audioContext && audioContext.state === "running") {
      try {
        await audioContext.suspend();
      } catch {
      }
    }
    return true;
  };
  const resumeAllAudio = async () => {
    audioPausedBySystem = false;
    if (!audioEnabled) {
      return false;
    }
    return ensureWebAudioReady();
  };
  const toggleSound = (forceEnabled) => {
    const nextEnabled = typeof forceEnabled === "boolean" ? forceEnabled : !audioEnabled;
    return setEnabled(nextEnabled);
  };
  return {
    unlockAudio,
    safePlay,
    playTrainHorn,
    playDistantSteamTrain,
    pauseAllAudio,
    resumeAllAudio,
    setEnabled,
    toggleSound,
    isEnabled: () => audioEnabled,
    isPausedBySystem: () => audioPausedBySystem,
    isUnlocked: () => {
      const webAudioRunning = !!audioContext && audioContext.state === "running";
      return mediaUnlocked || webAudioRunning;
    },
    getAudio: (soundKey) => sounds.get(soundKey) ?? null
  };
}
var convertFromCanvasToClientCoordinates = (canvasEl, canvasX, canvasY) => {
  if (!(canvasEl instanceof HTMLCanvasElement)) {
    console.error("Invalid canvas element");
    return null;
  }
  const canvasRect = canvasEl.getBoundingClientRect();
  const clientX = canvasRect.left + canvasX;
  const clientY = canvasRect.top + canvasY;
  return { clientX, clientY };
};
var animateMouseFromStartToEndCoordinates = async (startX, startY, endX, endY, options = {}) => {
  const durationMs = Number.isFinite(options.durationMs) ? options.durationMs : 1400;
  const startDelayMs = Number.isFinite(options.startDelayMs) ? options.startDelayMs : 120;
  return new Promise((resolve) => {
    const fakeCursor = document.createElement("div");
    fakeCursor.textContent = "\u25B2";
    fakeCursor.style.position = "fixed";
    fakeCursor.style.left = "0";
    fakeCursor.style.top = "0";
    fakeCursor.style.transform = `translate(${startX}px, ${startY}px)`;
    fakeCursor.style.transformOrigin = "center center";
    fakeCursor.style.fontSize = "24px";
    fakeCursor.style.lineHeight = "1";
    fakeCursor.style.color = "#111";
    fakeCursor.style.textShadow = "0 0 4px rgba(255,255,255,0.9)";
    fakeCursor.style.pointerEvents = "none";
    fakeCursor.style.zIndex = "100000";
    fakeCursor.style.opacity = "0";
    document.body.appendChild(fakeCursor);
    const easeInOutCubic = (t) => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };
    const start = performance.now() + startDelayMs;
    const step = (now) => {
      if (now < start) {
        requestAnimationFrame(step);
        return;
      }
      fakeCursor.style.opacity = "1";
      const rawProgress = (now - start) / durationMs;
      const progress = Math.max(0, Math.min(1, rawProgress));
      const eased = easeInOutCubic(progress);
      const currentX = startX + (endX - startX) * eased;
      const currentY = startY + (endY - startY) * eased;
      fakeCursor.style.transform = `translate(${currentX}px, ${currentY}px)`;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        fakeCursor.remove();
        resolve(true);
      }
    };
    requestAnimationFrame(step);
  });
};
var animateMouseFromCenterToElement = async (targetEl, options = {}) => {
  const durationMs = Number.isFinite(options.durationMs) ? options.durationMs : 1400;
  const startDelayMs = Number.isFinite(options.startDelayMs) ? options.startDelayMs : 120;
  return new Promise((resolve) => {
    if (!(targetEl instanceof HTMLElement)) {
      resolve(false);
      return;
    }
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    const targetRect = targetEl.getBoundingClientRect();
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    const fakeCursor = document.createElement("div");
    fakeCursor.textContent = "\u25B2";
    fakeCursor.style.position = "fixed";
    fakeCursor.style.left = "0";
    fakeCursor.style.top = "0";
    fakeCursor.style.transform = `translate(${startX}px, ${startY}px)`;
    fakeCursor.style.transformOrigin = "center center";
    fakeCursor.style.fontSize = "24px";
    fakeCursor.style.lineHeight = "1";
    fakeCursor.style.color = "#111";
    fakeCursor.style.textShadow = "0 0 4px rgba(255,255,255,0.9)";
    fakeCursor.style.pointerEvents = "none";
    fakeCursor.style.zIndex = "100000";
    fakeCursor.style.opacity = "0";
    document.body.appendChild(fakeCursor);
    const easeInOutCubic = (t) => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };
    const start = performance.now() + startDelayMs;
    const step = (now) => {
      if (now < start) {
        requestAnimationFrame(step);
        return;
      }
      fakeCursor.style.opacity = "1";
      const rawProgress = (now - start) / durationMs;
      const progress = Math.max(0, Math.min(1, rawProgress));
      const eased = easeInOutCubic(progress);
      const x = startX + (endX - startX) * eased;
      const y = startY + (endY - startY) * eased;
      fakeCursor.style.transform = `translate(${x}px, ${y}px)`;
      if (progress < 1) {
        requestAnimationFrame(step);
        return;
      }
      fakeCursor.style.transition = "transform 120ms ease-out";
      fakeCursor.style.transform = `translate(${endX}px, ${endY}px) scale(0.9)`;
      setTimeout(() => {
        fakeCursor.remove();
        resolve(true);
      }, 180);
    };
    requestAnimationFrame(step);
  });
};

// audioManager.js
var ENABLE_SFX = true;
var audioManager = createAudioManager(
  {
    beep: "./beep.mp3",
    train: "./train.wav",
    whistle: "./steam_engine_whistle.mp3",
    money: "./money.mp3",
    pop: "./pop.mp3",
    chugging: "./chugging_sound.mp3",
    traincollide: "./traincollide.mp3",
    drumroll: "./drumroll.mp3"
  },
  {
    enabled: ENABLE_SFX,
    soundGain: {
      money: 0.35,
      drumroll: 0.3
    },
    hornDefaults: {
      baseFrequency: 280,
      duration: 1.75,
      //0.75
      volume: 0.12,
      detune: 0
    }
  }
);

// Financials.js
var Financials = class _Financials {
  // track maintenance cost is calculated based on the distance traveled by the train on the track. 
  // We can have a fixed cost per unit distance traveled on the track. This way, the user will have 
  // to invest in maintaining the track if they want their trains to run smoothly and avoid breakdowns. 
  // This will add an additional layer of strategy for the user when they are building their tracks and stations.
  static CASH_IN_HAND = 2e7;
  constructor(totalTimeUnits = 100, numTrains = 9) {
    this.totalRevenue = Array.from({ length: totalTimeUnits }, () => new Array(numTrains).fill(0));
    this.totalExpenses = Array.from({ length: totalTimeUnits }, () => new Array(numTrains).fill(0));
    this.numStations = Array.from({ length: totalTimeUnits }, () => new Array(numTrains).fill(0));
    this.profit = Array.from({ length: totalTimeUnits }, () => new Array(numTrains).fill(0));
    this.stationCost = 1e6;
    this.FlyoverCost = 2e7;
    this.engineCost = 3e6;
    this.engineUpgradeCost = 2e6;
    this.coachCost = 1e5;
    this.collisionCost = 1e7;
    this.trackCostPerUnit = 1e3;
    this.depreciationOnEngineAndCoaches = 0.8;
    this.cumRevenueByTrain = new Array(numTrains).fill(0);
    this.cumCostByTrain = new Array(numTrains).fill(0);
    this.cumProfitByTrain = new Array(numTrains).fill(0);
    this.trackMaintenanceCostPerUnitPerTimePeriod = 2;
    this.stationMaintenanceCostPerStationPerTimePeriod = 50;
    this.cashInHand = _Financials.CASH_IN_HAND;
    this.totalTimeUnits = totalTimeUnits;
    this.parallelTrackCostPerSegment = 5e4;
  }
  upgradeEngine(timeIndex, trainNumber) {
    const trainIndex = trainNumber - 1;
    this.incrementExpenses(timeIndex, trainIndex, this.engineUpgradeCost, "Upgrading Engine");
  }
  incrementExpensesOfStationMaintenance(timeIndex, train, numStations) {
    const trainIndex = train.trainNumber - 1;
    const cost = this.stationMaintenanceCostPerStationPerTimePeriod * numStations;
    this.incrementExpenses(timeIndex, trainIndex, cost, "Station Maintenance");
  }
  incrementExpensesOfTrackMaintenance(timeIndex, train, distanceTraveled) {
    const trainIndex = train.trainNumber - 1;
    const cost = this.trackMaintenanceCostPerUnitPerTimePeriod * distanceTraveled;
    this.incrementExpenses(timeIndex, trainIndex, cost, "Track Maintenance");
  }
  incrementExpensesOfEngineAndCoachesDepreciation(timeIndex, trainNumber, numCoaches) {
    const trainIndex = trainNumber - 1;
    const engineDepreciation = this.engineCost * this.depreciationOnEngineAndCoaches;
    const coachesDepreciation = this.coachCost * numCoaches * this.depreciationOnEngineAndCoaches;
    const totalDepreciation = engineDepreciation + coachesDepreciation;
    this.incrementExpenses(timeIndex, trainIndex, totalDepreciation, "Engine and Coaches Depreciation");
  }
  incrementNumStations(timeIndex, trainIndex) {
    this.numStations[timeIndex][trainIndex]++;
  }
  decrementNumStations(timeIndex, trainIndex) {
    this.numStations[timeIndex][trainIndex]--;
  }
  incrementRevenue(timeIndex, trainIndex, amount, reason = "") {
    if (timeIndex < this.totalTimeUnits) {
      this.totalRevenue[timeIndex][trainIndex] += amount;
      this.cumRevenueByTrain[trainIndex] += amount;
      this.cumProfitByTrain[trainIndex] += amount;
      this.profit[timeIndex][trainIndex] += amount;
      const prevCashInHand = this.cashInHand;
      this.cashInHand += amount;
      if (Math.floor(this.cashInHand / 1e6) > Math.floor(prevCashInHand / 1e6)) {
        audioManager.safePlay("money", { volume: 0.05, restart: true });
      }
      if (Math.floor(this.cashInHand / 1e8) > Math.floor(prevCashInHand / 1e8)) {
        audioManager.safePlay("drumroll", { volume: 0.05, restart: true });
      }
    }
  }
  incrementExpenses(timeIndex, trainIndex, amount, reason = "") {
    if (timeIndex < this.totalTimeUnits) {
      this.totalExpenses[timeIndex][trainIndex] += amount;
      this.cumCostByTrain[trainIndex] += amount;
      this.cumProfitByTrain[trainIndex] -= amount;
      this.profit[timeIndex][trainIndex] -= amount;
      this.cashInHand -= amount;
    }
  }
  getCumFinancialSummaryByTrain() {
    return {
      totalRevenue: this.cumRevenueByTrain,
      totalExpenses: this.cumCostByTrain,
      profit: this.cumProfitByTrain
    };
  }
  //this is called externally and hence we use ticks to call it
  getFinancialSummary(timeIndex) {
    const totalRevenue = this.totalRevenue[timeIndex].reduce((a, b) => a + b, 0);
    const totalExpenses = this.totalExpenses[timeIndex].reduce((a, b) => a + b, 0);
    const profit = this.profit[timeIndex].reduce((a, b) => a + b, 0);
    return {
      totalRevenue,
      totalExpenses,
      profit
    };
  }
  getFinancialSummaryByTrain(timeIndex) {
    const totalRevenue = this.totalRevenue[timeIndex];
    const totalExpenses = this.totalExpenses[timeIndex];
    const profit = this.profit[timeIndex];
    return {
      totalRevenue,
      totalExpenses,
      profit
    };
  }
  //this is called externally and hence we use ticks, trainNumber to call it
  buyCoach(timeIndex, trainNumber, numCoaches) {
    const trainIndex = trainNumber - 1;
    const cost = this.coachCost * numCoaches;
    this.incrementExpenses(timeIndex, trainIndex, cost, "Buying Coaches");
    return cost;
  }
  //this is called externally and hence we use ticks, trainNumber to call it
  buyEngine(timeIndex, trainNumber) {
    const trainIndex = trainNumber - 1;
    this.incrementExpenses(timeIndex, trainIndex, this.engineCost, "Buying Engine");
    return this.engineCost;
  }
  //this is called externally and hence we use ticks, trainNumber to call it
  incrementTrackCost(timeIndex, trainNumber, distance) {
    const trainIndex = trainNumber - 1;
    const cost = this.trackCostPerUnit * distance;
    this.incrementExpenses(timeIndex, trainIndex, cost, "Track Cost");
    return cost;
  }
  //this is called externally and hence we use ticks, trainNumber to call it
  incrementCollisionCost(timeIndex, trainNumber1, trainNumber2) {
    const trainIndex1 = trainNumber1 - 1;
    const trainIndex2 = trainNumber2 - 1;
    this.incrementExpenses(timeIndex, trainIndex1, this.collisionCost / 2, "Collision Cost");
    this.incrementExpenses(timeIndex, trainIndex2, this.collisionCost / 2, "Collision Cost");
    return this.collisionCost;
  }
  //increment the cost of flyover which is shared by two trains that are involved
  incrementFlyoverCost(timeIndex, trainNumber1, trainNumber2) {
    const trainIndex1 = trainNumber1 - 1;
    const trainIndex2 = trainNumber2 - 1;
    this.incrementExpenses(timeIndex, trainIndex1, this.FlyoverCost / 2, "Flyover Cost");
    this.incrementExpenses(timeIndex, trainIndex2, this.FlyoverCost / 2, "Flyover Cost");
    return this.FlyoverCost;
  }
  getStationCost() {
    return this.stationCost;
  }
  addStation(timeIndex, trainNumber) {
    const cost = this.getStationCost();
    const trainIndex = trainNumber - 1;
    this.incrementExpenses(timeIndex, trainIndex, cost, "Adding Station");
    this.incrementNumStations(timeIndex, trainIndex);
  }
  deleteStation(timeIndex, trainNumber) {
    const trainIndex = trainNumber - 1;
    this.decrementNumStations(timeIndex, trainIndex);
  }
  incrementRevenueFromTickets(timeIndex, trainNumber, amount) {
    const trainIndex = trainNumber - 1;
    this.incrementRevenue(timeIndex, trainIndex, amount, "Ticket Revenue");
    return amount;
  }
  incrementRevenueFromRawMaterial(timeIndex, trainNumber, amount) {
    const trainIndex = trainNumber - 1;
    this.incrementRevenue(timeIndex, trainIndex, amount, "Freight Revenue");
    return amount;
  }
  cumProfit() {
    return this.cumProfitByTrain.reduce((a, b) => a + b, 0);
  }
};

// Flyover.js
var Flyover = class _Flyover {
  //Flyover objet becomes necessary so that we do not register collisions at the Flyover intersection
  //row and col are 0 based indices of the Flyover in the grid. They are used to determine the position of the Flyover and to check for collisions at the Flyover intersection.
  static FLYOVER_CIRCLE_RADIUS = 25;
  constructor(row, col) {
    this.row = row;
    this.col = col;
  }
  draw(ctx2, gridSize2, offsetX = 0, offsetY = 0) {
    const x = offsetX + this.col * gridSize2;
    const y = offsetY + this.row * gridSize2;
    ctx2.save();
    ctx2.beginPath();
    ctx2.fillStyle = "rgba(0, 255, 0, 0.5)";
    ctx2.arc(x, y, _Flyover.FLYOVER_CIRCLE_RADIUS, 0, 2 * Math.PI);
    ctx2.fill();
    ctx2.closePath();
    ctx2.restore();
  }
};

// Intersections.js
var Intersections = class {
  constructor(canvasWidth, canvasHeight, gridSize2, offsetX = 0, offsetY = 0) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.gridSize = gridSize2;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.rowCount = Math.floor(canvasHeight / gridSize2) + 1;
    this.colCount = Math.floor(canvasWidth / gridSize2) + 1;
    this.intersections = Array.from({ length: this.rowCount }, () => Array(this.colCount).fill(null));
    this.laneOccupancy = /* @__PURE__ */ new Map();
    this.allowedTrainsByCell = /* @__PURE__ */ new Map();
  }
  getCellKey(row, col) {
    return `${row},${col}`;
  }
  // Returns the cell at the given canvas position if it is within the 
  // threshold distance from the cell center, otherwise returns null.
  getCellAtPosition(x, y, threshold = 10) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    if (x < this.offsetX || y < this.offsetY) {
      return null;
    }
    const col = Math.round((x - this.offsetX) / this.gridSize);
    const row = Math.round((y - this.offsetY) / this.gridSize);
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return null;
    }
    const centerX = this.offsetX + col * this.gridSize;
    const centerY = this.offsetY + row * this.gridSize;
    const distanceToCenter = Math.abs(x - centerX) + Math.abs(y - centerY);
    if (distanceToCenter < threshold) {
      return { row, col, x: centerX, y: centerY };
    }
    return null;
  }
  getCanvasPoint(row, col) {
    return {
      x: this.offsetX + col * this.gridSize,
      y: this.offsetY + row * this.gridSize
    };
  }
  getCellFromCanvasPoint(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    const col = Math.round((x - this.offsetX) / this.gridSize);
    const row = Math.round((y - this.offsetY) / this.gridSize);
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return null;
    }
    return { row, col };
  }
  allowTrainsAtCell(row, col, trainNumbers = []) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return;
    }
    const validTrainNumbers = trainNumbers.filter((trainNumber) => Number.isFinite(trainNumber));
    if (validTrainNumbers.length < 2) {
      return;
    }
    const key = this.getCellKey(row, col);
    const allowedTrains = this.allowedTrainsByCell.get(key) ?? /* @__PURE__ */ new Set();
    validTrainNumbers.forEach((trainNumber) => allowedTrains.add(trainNumber));
    this.allowedTrainsByCell.set(key, allowedTrains);
  }
  getAllowedTrainsAtCell(row, col) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return /* @__PURE__ */ new Set();
    }
    const key = this.getCellKey(row, col);
    return this.allowedTrainsByCell.get(key) ?? /* @__PURE__ */ new Set();
  }
  allowTrainsForCommonSegments(commonSegmentsMap, trainNumbers = []) {
    if (!(commonSegmentsMap instanceof Map)) {
      return;
    }
    commonSegmentsMap.forEach((segment) => {
      const startCell = this.getCellFromCanvasPoint(segment.startx, segment.starty);
      const endCell = this.getCellFromCanvasPoint(segment.endx, segment.endy);
      if (startCell) {
        this.allowTrainsAtCell(startCell.row, startCell.col, trainNumbers);
      }
      if (endCell) {
        this.allowTrainsAtCell(endCell.row, endCell.col, trainNumbers);
      }
    });
  }
  updateIntersection(row, col, trainNumber, lane = 0) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return;
    }
    if (this.intersections[row][col] === "Flyover" || this.intersections[row][col] === "Station") {
      return;
    }
    const laneNumber = Number.isFinite(lane) ? lane : 0;
    const key = this.getCellKey(row, col);
    const occupancyByLane = this.laneOccupancy.get(key);
    if (trainNumber === null || trainNumber === void 0) {
      if (!occupancyByLane) return;
      occupancyByLane.delete(laneNumber);
      if (occupancyByLane.size === 0) {
        this.laneOccupancy.delete(key);
      }
      return;
    }
    const lanes = occupancyByLane ?? /* @__PURE__ */ new Map();
    const currentTrain = lanes.get(laneNumber);
    if (currentTrain != null && currentTrain !== trainNumber) {
      const allowedTrains = this.allowedTrainsByCell.get(key);
      if (allowedTrains && allowedTrains.has(currentTrain) && allowedTrains.has(trainNumber)) {
        return;
      }
      const event = new Event("collision");
      event.train1 = currentTrain;
      event.train2 = trainNumber;
      event.row = row;
      event.col = col;
      event.lane = laneNumber;
      lanes.delete(laneNumber);
      if (lanes.size === 0) {
        this.laneOccupancy.delete(key);
      } else {
        this.laneOccupancy.set(key, lanes);
      }
      audioManager.safePlay("traincollide", 1);
      window.dispatchEvent(event);
    } else {
      lanes.set(laneNumber, trainNumber);
      this.laneOccupancy.set(key, lanes);
    }
  }
  updateIntersectionsWithFlyoverLocation(row, col, Flyover2) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return;
    }
    this.intersections[row][col] = Flyover2 ? "Flyover" : null;
    this.laneOccupancy.delete(this.getCellKey(row, col));
  }
  updateIntersectionsWithStationLocation(row, col, Station2) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return;
    }
    this.intersections[row][col] = Station2 === true ? "Station" : null;
    this.laneOccupancy.delete(this.getCellKey(row, col));
  }
  removeTrain(trainNumber) {
    this.laneOccupancy.forEach((occupancyByLane, key) => {
      occupancyByLane.forEach((occupiedTrain, laneNumber) => {
        if (occupiedTrain === trainNumber) {
          occupancyByLane.delete(laneNumber);
        }
      });
      if (occupancyByLane.size === 0) {
        this.laneOccupancy.delete(key);
      }
    });
    this.allowedTrainsByCell.forEach((allowedTrains, key) => {
      if (allowedTrains.has(trainNumber)) {
        allowedTrains.delete(trainNumber);
        if (allowedTrains.size < 2) {
          this.allowedTrainsByCell.delete(key);
        }
      }
    });
    for (let row = 0; row < this.rowCount; row++) {
      for (let col = 0; col < this.colCount; col++) {
        if (this.intersections[row][col] === trainNumber) {
          this.intersections[row][col] = null;
        }
      }
    }
  }
};

// Flyovers.js
var Flyovers2 = class {
  constructor(ctx2, gridSize2, offsetX = 0, offsetY = 0) {
    this.ctx = ctx2;
    this.gridSize = gridSize2;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.Flyovers = [];
    this.possibleFlyoverLocations = [];
  }
  setPossibleFlyoverLocations(locations) {
    this.possibleFlyoverLocations = locations;
  }
  addFlyover(Flyover2) {
    this.Flyovers.push(Flyover2);
    Flyover2.draw(this.ctx, this.gridSize, this.offsetX, this.offsetY);
    return Flyover2;
  }
  getFlyoverAtPosition(row, col) {
    return this.Flyovers.find((Flyover2) => Flyover2.row === row && Flyover2.col === col);
  }
  isFlyoverAtPosition(row, col) {
    return this.Flyovers.some((Flyover2) => Flyover2.row === row && Flyover2.col === col);
  }
  getAllFlyovers() {
    return this.Flyovers;
  }
  deleteFlyover(row, col) {
    this.Flyovers = this.Flyovers.filter((Flyover2) => !(Flyover2.row === row && Flyover2.col === col));
  }
  draw() {
    this.Flyovers.forEach((Flyover2) => {
      Flyover2.draw(this.ctx, this.gridSize, this.offsetX, this.offsetY);
    });
  }
};

// Station.js
var Station = class _Station {
  static STATION_CIRCLE_RADIUS = 20;
  // we need to think about the trains that pass through the station that is not related to their track. 
  // For example, if a train is passing through a station that is not on its track, then 
  // will the train stop or go through without stopping. I think it is better for the train to go through without stopping because it is not related to the train's track and it will not cause any issues for the train. However, we can add a cost for passing through a station that is not related to the train's track. This way, the user will have to invest in the station if they want their trains to pass through it without stopping. 
  // This will add an additional layer of strategy for the user when they are building their tracks and stations.
  // station is passed ctx_tracks because we want to draw the station on the tracks layer so that it appears below the trains. If we draw the station on the main ctx, then it will appear above the trains and it will look weird when the train is passing through the station.
  constructor(canvasWidth, canvasHeight, ctx2, x, y, gridSize2, distanceFromStart, trainNumber, dwellTime = 30) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.ctx = ctx2;
    this.x = x;
    this.y = y;
    this.distanceFromStart = distanceFromStart;
    this.name = this.stationName(x, y, gridSize2, trainNumber);
    this.dwellTime = dwellTime;
    this.stationNumber = 0;
    this.totalStations = 0;
  }
  stationName(x, y, gridSize2, trainNumber) {
    const [rowName, colName] = rowAndColumnName(x, y, gridSize2);
    return `${colName}-${rowName}`;
  }
  draw() {
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, _Station.STATION_CIRCLE_RADIUS, 0, 2 * Math.PI);
    this.ctx.fillStyle = "rgba(255,0,0,0.5)";
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255,0,0,1)";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.font = "bold 16px Arial";
    this.ctx.fillStyle = "black";
    let xOffset = -10;
    let yOffset = 0;
    if (this.x == 0) {
      xOffset = 10;
    } else if (this.x == this.canvasWidth) {
      xOffset = -10;
    }
    if (this.y == 0) {
      yOffset = 10;
    } else if (this.y == this.canvasHeight) {
      yOffset = -10;
    }
    this.ctx.fillText(this.name, this.x + xOffset, this.y + yOffset);
  }
};
function createStation(canvasWidth, canvasHeight, ctx2, x, y, gridSize2, distanceFromStart, trainNumber, dwellTime = 30) {
  return new Station(canvasWidth, canvasHeight, ctx2, x, y, gridSize2, distanceFromStart, trainNumber, dwellTime);
}

// Population.js
var Population = class _Population {
  //How it works
  // uniform 0-1
  // const t = rawValue / upperBound
  // // apply power — exponent > 1 skews toward 0 (most areas sparse)
  // //               exponent < 1 skews toward upperBound (most areas dense)
  // const skewed = Math.pow(t, exponent)
  // return Math.round(skewed * upperBound)
  /*
  With exponent = 3, ~90% of grid points will have low population and a few will be very high — realistic for a map with a couple of dense cities surrounded by countryside.
  
  The skew is now controlled by a skewExponent parameter (default 3). A few reference points:
  
  skewExponent	Effect
  1	Uniform — original behaviour
  2	Mildly skewed, most areas below 50%
  3	Strongly skewed, few high-population hotspots (default)
  0.5	Inverse — most areas are dense, few are very sparse
  To change it at construction time:
  
  new Population(CANVASWIDTH, CANVASHEIGHT, gridSize, 123456789, 3)
  //                                                              ^ change this
  */
  static UPPER_BOUND = 1e6;
  static NE_ADJUST = 0.5;
  // reduce population in northeast quadrant to create a more interesting map with one dense city and one sparse city
  static VERYBIG_ADJUST = 10;
  // increase population in very big cities to make them more distinct
  constructor(canvasWidth, canvasHeight, gridSize2, seed = 123456789, skewExponent = 4) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.gridSize = gridSize2;
    this.seed = seed >>> 0;
    this.values = /* @__PURE__ */ new Map();
    this.upperBound = _Population.UPPER_BOUND;
    this.skewExponent = skewExponent;
    this.generate();
    this.displayStatistics();
  }
  displayStatistics() {
    const populations = Array.from(this.values.values());
    const totalPopulation = populations.reduce((a, b) => a + b, 0);
    let northPopulation = 0;
    let southPopulation = 0;
    let eastPopulation = 0;
    let westPopulation = 0;
    for (let y = 0; y <= this.canvasHeight; y += this.gridSize) {
      for (let x = 0; x <= this.canvasWidth; x += this.gridSize) {
        const pop = this.values.get(this.getKey(x, y)) ?? 0;
        if (y < this.canvasHeight / 2) {
          northPopulation += pop;
        } else if (y > this.canvasHeight / 2) {
          southPopulation += pop;
        } else {
          northPopulation += pop / 2;
          southPopulation += pop / 2;
        }
        if (x < this.canvasWidth / 2) {
          westPopulation += pop;
        } else if (x > this.canvasWidth / 2) {
          eastPopulation += pop;
        } else {
          westPopulation += pop / 2;
          eastPopulation += pop / 2;
        }
      }
    }
  }
  getKey(x, y) {
    return `${x},${y}`;
  }
  // Coordinate-based hash gives deterministic pseudo-random values for each grid point.
  valueFromCoordinate(x, y) {
    let h = this.seed;
    h ^= x + 2654435769 + (h << 6) + (h >> 2) >>> 0;
    h ^= y + 2246822507 + (h << 6) + (h >> 2) >>> 0;
    h = Math.imul(h ^ h >>> 16, 73244475) >>> 0;
    h = Math.imul(h ^ h >>> 16, 73244475) >>> 0;
    h = (h ^ h >>> 16) >>> 0;
    const uniform = h % (this.upperBound + 1) / this.upperBound;
    const skewed = Math.pow(uniform, this.skewExponent);
    return Math.round(skewed * this.upperBound);
  }
  generate() {
    this.values.clear();
    for (let x = 0; x <= this.canvasWidth; x += this.gridSize) {
      for (let y = 0; y <= this.canvasHeight; y += this.gridSize) {
        if (x > this.canvasWidth / 2 && y < this.canvasHeight / 2) {
          this.values.set(this.getKey(x, y), Math.round(this.valueFromCoordinate(x, y) * _Population.NE_ADJUST));
        } else {
          this.values.set(this.getKey(x, y), this.valueFromCoordinate(x, y));
        }
      }
    }
    this.values.set("1200,500", this.valueFromCoordinate(1200, 500) * _Population.VERYBIG_ADJUST);
    this.values.set("1900,1000", this.valueFromCoordinate(1900, 1e3) * _Population.VERYBIG_ADJUST);
    this.values.set("500,1200", this.valueFromCoordinate(500, 1200) * _Population.VERYBIG_ADJUST);
    this.values.set("250,250", this.valueFromCoordinate(250, 250) * _Population.VERYBIG_ADJUST);
    this.values.set("2400,1350", this.valueFromCoordinate(2400, 1350) * _Population.VERYBIG_ADJUST);
  }
  getPopulationAt(x, y) {
    const snappedX = Math.round(x / this.gridSize) * this.gridSize;
    const snappedY = Math.round(y / this.gridSize) * this.gridSize;
    return this.values.get(this.getKey(snappedX, snappedY)) ?? 0;
  }
  getAll() {
    const result = [];
    this.values.forEach((population, key) => {
      const [x, y] = key.split(",").map(Number);
      result.push({ x, y, population });
    });
    return result;
  }
};

// TravelPopulation.js
var TravelPopulation = class _TravelPopulation {
  static TRAVEL_PER_TIME_UNIT = 0.05;
  // 0.05% of the population travels each time unit, adjust as needed
  constructor(population, canvasWidth, canvasHeight, gridSize2) {
    this.travelPopulation = /* @__PURE__ */ new Map();
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.gridSize = gridSize2;
    this.generateTravelPopulation(population);
    this.displayStatistics();
  }
  generateTravelPopulation(population) {
    let grandTotalPopulation = 0;
    for (const [key, pop] of population.values.entries()) {
      const [x, y] = key.split(",").map(Number);
      const adjacentKeys = [
        `${x},${y}`,
        `${x + population.gridSize},${y}`,
        `${x - population.gridSize},${y}`,
        `${x},${y + population.gridSize}`,
        `${x},${y - population.gridSize}`
      ];
      let totalPop = 0;
      for (const adjKey of adjacentKeys) {
        if (population.values.has(adjKey)) {
          totalPop += population.values.get(adjKey);
        }
      }
      const travelPop = Math.floor(totalPop * _TravelPopulation.TRAVEL_PER_TIME_UNIT);
      grandTotalPopulation += travelPop;
      this.travelPopulation.set(key, { population: travelPop, percent: 0 });
    }
    for (const [key, travelData] of this.travelPopulation.entries()) {
      const percent = grandTotalPopulation > 0 ? travelData.population / grandTotalPopulation * 100 : 0;
      this.travelPopulation.set(key, { population: travelData.population, percent });
    }
  }
  displayStatistics() {
    const travelPops = Array.from(this.travelPopulation.values());
    const totalPopulation = travelPops.reduce((a, b) => a + b.population, 0);
    let northPopulation = 0;
    let southPopulation = 0;
    let eastPopulation = 0;
    let westPopulation = 0;
    for (let y = 0; y <= this.canvasHeight; y += this.gridSize) {
      for (let x = 0; x <= this.canvasWidth; x += this.gridSize) {
        const travelData = this.travelPopulation.get(this.getKey(x, y)) ?? { population: 0, percent: 0 };
        const pop = travelData.population;
        if (y < this.canvasHeight / 2) {
          northPopulation += pop;
        } else if (y > this.canvasHeight / 2) {
          southPopulation += pop;
        } else {
          northPopulation += pop / 2;
          southPopulation += pop / 2;
        }
        if (x < this.canvasWidth / 2) {
          westPopulation += pop;
        } else if (x > this.canvasWidth / 2) {
          eastPopulation += pop;
        } else {
          westPopulation += pop / 2;
          eastPopulation += pop / 2;
        }
      }
    }
  }
  getKey(x, y) {
    return `${x},${y}`;
  }
};

// Rawmaterials.js
var Rawmaterials = class _Rawmaterials {
  //How it works
  // uniform 0-1
  // const t = rawValue / upperBound
  // // apply power — exponent > 1 skews toward 0 (most areas sparse)
  // //               exponent < 1 skews toward upperBound (most areas dense)
  // const skewed = Math.pow(t, exponent)
  // return Math.round(skewed * upperBound)
  /*
  With exponent = 3, ~90% of grid points will have low rawmaterial and a few will be very high — realistic for a map with a couple of dense cities surrounded by countryside.
  
  The skew is now controlled by a skewExponent parameter (default 3). A few reference points:
  
  skewExponent	Effect
  1	Uniform — original behaviour
  2	Mildly skewed, most areas below 50%
  3	Strongly skewed, few high-rawmaterial hotspots (default)
  0.5	Inverse — most areas are dense, few are very sparse
  To change it at construction time:
  
  new Rawmaterial(CANVASWIDTH, CANVASHEIGHT, gridSize, 123456789, 3)
  //                                                              ^ change this
  */
  static UPPER_BOUND = 1e6;
  static NE_ADJUST = 5;
  // increase raw material availablity in northeast quadrant.
  static VERYSMALL_ADJUST = 0.01;
  // reduce rawmaterial in very big cities to make them more distinct
  static PRUNE_BELOW = 2e4;
  // prune raw material below this value to create more empty space on the map and make the hotspots more distinct
  constructor(canvasWidth, canvasHeight, gridSize2, seed = 987654321, skewExponent = 5) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.gridSize = gridSize2;
    this.seed = seed >>> 0;
    this.values = /* @__PURE__ */ new Map();
    this.upperBound = _Rawmaterials.UPPER_BOUND;
    this.skewExponent = skewExponent;
    this.generate();
    this.displayStatistics();
  }
  displayStatistics() {
    let northRawmaterial = 0;
    let southRawmaterial = 0;
    let eastRawmaterial = 0;
    let westRawmaterial = 0;
    for (let y = 0; y <= this.canvasHeight; y += this.gridSize) {
      for (let x = 0; x <= this.canvasWidth; x += this.gridSize) {
        const pop = this.values.get(this.getKey(x, y)) ?? 0;
        if (y < this.canvasHeight / 2) {
          northRawmaterial += pop;
        } else if (y > this.canvasHeight / 2) {
          southRawmaterial += pop;
        } else {
          northRawmaterial += pop / 2;
          southRawmaterial += pop / 2;
        }
        if (x < this.canvasWidth / 2) {
          westRawmaterial += pop;
        } else if (x > this.canvasWidth / 2) {
          eastRawmaterial += pop;
        } else {
          westRawmaterial += pop / 2;
          eastRawmaterial += pop / 2;
        }
      }
    }
  }
  getKey(x, y) {
    return `${x},${y}`;
  }
  // Coordinate-based hash gives deterministic pseudo-random values for each grid point.
  // do not use this directly. Use the getRawmaterialAt method which has modified vaues for certain grid points to create interesting hotspots.
  valueFromCoordinate(x, y) {
    let h = this.seed;
    h ^= x + 2654435769 + (h << 6) + (h >> 2) >>> 0;
    h ^= y + 2246822507 + (h << 6) + (h >> 2) >>> 0;
    h = Math.imul(h ^ h >>> 16, 73244475) >>> 0;
    h = Math.imul(h ^ h >>> 16, 73244475) >>> 0;
    h = (h ^ h >>> 16) >>> 0;
    const uniform = h % (this.upperBound + 1) / this.upperBound;
    const skewed = Math.pow(uniform, this.skewExponent);
    return Math.round(skewed * this.upperBound);
  }
  generate() {
    this.values.clear();
    for (let x = 0; x <= this.canvasWidth; x += this.gridSize) {
      for (let y = 0; y <= this.canvasHeight; y += this.gridSize) {
        if (x > this.canvasWidth / 2 && y < this.canvasHeight / 2) {
          this.values.set(this.getKey(x, y), Math.round(this.valueFromCoordinate(x, y) * _Rawmaterials.NE_ADJUST));
        } else {
          this.values.set(this.getKey(x, y), this.valueFromCoordinate(x, y));
        }
        if (this.values.get(this.getKey(x, y)) < _Rawmaterials.PRUNE_BELOW) {
          this.values.set(this.getKey(x, y), 0);
        }
      }
    }
    this.values.set("1200,500", 0);
  }
  getRawmaterialAt(x, y) {
    const snappedX = Math.round(x / this.gridSize) * this.gridSize;
    const snappedY = Math.round(y / this.gridSize) * this.gridSize;
    return this.values.get(this.getKey(snappedX, snappedY)) ?? 0;
  }
  getAll() {
    const result = [];
    this.values.forEach((rawmaterial, key) => {
      const [x, y] = key.split(",").map(Number);
      result.push({ x, y, rawmaterial });
    });
    return result;
  }
};

// RawmaterialDemand.js
var RawmaterialDemand = class {
  // this is the demand for raw materials per time period at each grid point. This is where the factories are located. 
  // The demand will be fulfilled by the raw material supply and the transportation network. 
  // The demand will be reduced when raw material is moved to the demand center and increased 
  // automatically at the elapse of each time unit to simulate the ongoing demand for raw materials.
  constructor(canvasWidth, canvasHeight, gridSize2) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.gridSize = gridSize2;
    this.singlePeriodDemand = [
      { x: 300, y: 200, demand: 5e4 },
      { x: 300, y: 600, demand: 5e5 },
      { x: 100, y: 700, demand: 1e5 },
      { x: 200, y: 1400, demand: 1e4 },
      { x: 1e3, y: 400, demand: 7e5 },
      { x: 1900, y: 1e3, demand: 3e5 },
      { x: 1600, y: 1100, demand: 1e5 }
    ];
    this.values = /* @__PURE__ */ new Map();
    this.generate();
    this.displayStatistics();
  }
  generate() {
    for (const { x, y, demand } of this.singlePeriodDemand) {
      this.values.set(this.getKey(x, y), demand);
    }
  }
  incrementTimeUnit() {
    for (const [key, demand] of this.values.entries()) {
      const unfulfilledDemand = Number.isFinite(demand) ? demand : 0;
      const baseDemand = this.singlePeriodDemand.find((d) => this.getKey(d.x, d.y) === key)?.demand ?? 0;
      const newDemand = baseDemand * 1.01;
      this.values.set(key, unfulfilledDemand + newDemand);
    }
  }
  getKey(x, y) {
    return `${x},${y}`;
  }
  getAll() {
    const result = [];
    for (let y = 0; y <= this.canvasHeight; y += this.gridSize) {
      for (let x = 0; x <= this.canvasWidth; x += this.gridSize) {
        const rawmaterial = this.values.get(this.getKey(x, y)) ?? 0;
        result.push({ x, y, rawmaterial });
      }
    }
    return result;
  }
  displayStatistics() {
    const rawmaterialDemand = Array.from(this.values.values());
    const totalRawmaterialDemand = rawmaterialDemand.reduce((a, b) => a + b, 0);
  }
  demandAt(x, y) {
    let totalDemand = 0;
    for (let dy = -2 * this.gridSize; dy <= 2 * this.gridSize; dy += this.gridSize) {
      for (let dx = -2 * this.gridSize; dx <= 2 * this.gridSize; dx += this.gridSize) {
        const currentDemand = this.values.get(this.getKey(x + dx, y + dy));
        const demand = Number.isFinite(currentDemand) ? currentDemand : 0;
        if (dx === 0 && dy === 0) {
          totalDemand += demand;
        } else if (Math.abs(dx) == 2 * this.gridSize || Math.abs(dy) === 2 * this.gridSize) {
          totalDemand += demand * 0.1;
        } else {
          totalDemand += demand * 0.5;
        }
      }
    }
    return totalDemand;
  }
  decreaseDemand(x, y, amount) {
    const demandCenters = [];
    for (let x1 = 0; x1 <= this.canvasWidth; x1 += this.gridSize) {
      for (let y1 = 0; y1 <= this.canvasHeight; y1 += this.gridSize) {
        const demand = this.values.get(this.getKey(x1, y1)) ?? 0;
        if (demand > 0) {
          const distance = Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
          demandCenters.push({ x: x1, y: y1, distance, demand });
        }
      }
    }
    demandCenters.sort((a, b) => a.distance - b.distance);
    let i = 0;
    while (amount > 0 && i < demandCenters.length) {
      const nextClosest = demandCenters[i];
      const nextKey = this.getKey(nextClosest.x, nextClosest.y);
      const nextCurrentDemand = this.values.get(nextKey) ?? 0;
      if (nextCurrentDemand > amount) {
        this.values.set(nextKey, Math.max(nextCurrentDemand - amount, 0));
        amount = 0;
      } else {
        this.values.set(nextKey, 0);
        amount -= nextCurrentDemand;
      }
      i++;
    }
  }
};

// RawMaterialSupply.js
var RawMaterialSupply = class _RawMaterialSupply {
  // Raw material reserves are available in Rawmaterial object but only this amount becomes available each time unit.
  static PRODUCTION_PER_TIME_UNIT = 0.015;
  // proportion of raw material from adjacent grid points that becomes available at this grid point each time unit, adjust as needed
  static PROPORTION_FROM_ADJACENT = 0.8;
  constructor(canvasWidth, canvasHeight, gridSize2) {
    this.rawmaterials = new Rawmaterials(canvasWidth, canvasHeight, gridSize2);
    this.rawmaterialAvailability = /* @__PURE__ */ new Map();
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.gridSize = gridSize2;
    this.generateRawmaterialAvailability();
  }
  generateRawmaterialAvailability() {
    for (const [key, rawmaterial] of this.rawmaterials.values.entries()) {
      const [x, y] = key.split(",").map(Number);
      const adjacentKeys = [
        `${x},${y}`,
        `${x + this.gridSize},${y}`,
        `${x - this.gridSize},${y}`,
        `${x},${y + this.gridSize}`,
        `${x},${y - this.gridSize}`
      ];
      let totalRawmaterial = 0;
      for (const adjKey of adjacentKeys) {
        if (this.rawmaterials.values.has(adjKey)) {
          if (adjKey === key) {
            totalRawmaterial += this.rawmaterials.values.get(adjKey);
          } else {
            totalRawmaterial += this.rawmaterials.values.get(adjKey) * _RawMaterialSupply.PROPORTION_FROM_ADJACENT;
          }
        }
      }
      const availableRawmaterial = Math.floor(totalRawmaterial * _RawMaterialSupply.PRODUCTION_PER_TIME_UNIT);
      this.rawmaterialAvailability.set(key, { available: availableRawmaterial, availableNextTimeUnit: availableRawmaterial });
    }
  }
  availableAt(x, y) {
    const key = this.getKey(x, y);
    const availabilityData = this.rawmaterialAvailability.get(key) ?? { available: 0, availableNextTimeUnit: 0 };
    return availabilityData.available;
  }
  incrementTimeUnit() {
    for (const [key, availabilityData] of this.rawmaterialAvailability.entries()) {
      const newAvailable = availabilityData.availableNextTimeUnit;
      this.rawmaterialAvailability.set(key, { available: availabilityData.available + newAvailable, availableNextTimeUnit: newAvailable });
    }
  }
  decreaseRawMaterial(x, y, amount) {
    const key = this.getKey(x, y);
    const availabilityData = this.rawmaterialAvailability.get(key) ?? { available: 0, availableNextTimeUnit: 0 };
    const newAvailable = Math.max(availabilityData.available - amount, 0);
    this.rawmaterialAvailability.set(key, { available: newAvailable, availableNextTimeUnit: availabilityData.availableNextTimeUnit });
  }
  getKey(x, y) {
    return `${x},${y}`;
  }
  getAll() {
    const result = [];
    this.rawmaterialAvailability.forEach((rawmaterial, key) => {
      const [x, y] = key.split(",").map(Number);
      result.push({ x, y, rawmaterial: rawmaterial.available });
    });
    return result;
  }
};

// Popups.js
var Popups = class {
  // popups map will store an array of popup info for each station and train. 
  // The key will be the station or train coordinates in the format "x,y" and the value will be an array of popup info objects. 
  // Each popup info object will have a type (station or train) and the relevant information to display in the popup.
  constructor() {
    this.popupMap = /* @__PURE__ */ new Map();
  }
  addStation(x, y, stationName) {
    const key = this.getKey(x, y);
    const popupInfo = this.popupMap.get(key) || { Stations: [], Trains: [] };
    if (!popupInfo.Stations.find((name) => name === stationName)) {
      popupInfo.Stations.push(stationName);
    }
    this.popupMap.set(key, popupInfo);
  }
  addTrain({ x, y, stationName, trainNumber, trainInfo1, trainInfo2 }) {
    const key = this.getKey(x, y);
    const popupInfo = this.popupMap.get(key) || { Stations: [], Trains: [] };
    if (!popupInfo.Stations.find((station) => station === stationName)) {
      popupInfo.Stations.push(stationName);
    }
    if (!popupInfo.Trains.find((train) => train.Trainnumber === trainNumber)) {
      popupInfo.Trains.push({ "Trainnumber": trainNumber, "TrainInfo1": trainInfo1, "TrainInfo2": trainInfo2 });
    } else {
      const existingTrain = popupInfo.Trains.find((train) => train.Trainnumber === trainNumber);
      existingTrain.TrainInfo1 = trainInfo1;
      existingTrain.TrainInfo2 = trainInfo2;
    }
    this.popupMap.set(key, popupInfo);
  }
  getPopupInfo(x, y) {
    const key = this.getKey(x, y);
    return this.popupMap.get(key) || { Stations: [], Trains: [] };
  }
  getKey(x, y) {
    return `${x},${y}`;
  }
};

// TrainInfo.js
var TrainInfo = class _TrainInfo {
  static MAX_ENTRIES_PER_PERIOD = 200;
  constructor(numTrains, numPeriods) {
    this.numTrains = numTrains;
    this.numPeriods = numPeriods;
    this.trainInfo = Array.from({ length: numTrains }, () => new Array(numPeriods).fill(null));
  }
  getTrainInfoForTrainAndTimeIndex(trainNumber, timeIndex) {
    return this.getTrainInfo(trainNumber, timeIndex);
  }
  getTrainInfoAllPeriods(trainNumber) {
    if (trainNumber < 1 || trainNumber > this.numTrains) {
      throw new Error(`Invalid train number: ${trainNumber}`);
    }
    return this.trainInfo[trainNumber - 1];
  }
  getTrainInfo(trainNumber, timeIndex) {
    if (trainNumber < 1 || trainNumber > this.numTrains) {
      throw new Error(`Invalid train number: ${trainNumber}`);
    }
    if (timeIndex < 0 || timeIndex >= this.numPeriods) {
      throw new Error(`Invalid time index: ${timeIndex}`);
    }
    return this.trainInfo[trainNumber - 1][timeIndex];
  }
  setTrainInfo(trainNumber, timeIndex, info) {
    if (trainNumber < 1 || trainNumber > this.numTrains) {
      throw new Error(`Invalid train number: ${trainNumber}`);
    }
    if (timeIndex < 0 || timeIndex >= this.numPeriods) {
      throw new Error(`Invalid time index: ${timeIndex}`);
    }
    if (this.trainInfo[trainNumber - 1][timeIndex] == null) {
      this.trainInfo[trainNumber - 1][timeIndex] = [];
    }
    const entries = this.trainInfo[trainNumber - 1][timeIndex];
    entries.push(info);
    if (entries.length > _TrainInfo.MAX_ENTRIES_PER_PERIOD) {
      entries.splice(0, entries.length - _TrainInfo.MAX_ENTRIES_PER_PERIOD);
    }
  }
};

// Game.js
var Game = class {
  TRAINCONFIG = [
    { defaultName: "Red", Color: "rgba(255,0,0,0.5)" },
    { defaultName: "Violet", Color: "rgba(125,0,255,0.5)" },
    { defaultName: "Blue", Color: "rgba(0,0,255,0.5)" },
    { defaultName: "Yellow", Color: "rgba(255,255,0,0.5)" },
    { defaultName: "Magenta", Color: "rgba(255,0,255,0.5)" },
    { defaultName: "Cyan", Color: "rgba(0,255,255,0.5)" }
  ];
  constructor(ctx2, ctxTracks2, ctxTemp2, ctxDemoTracks2, gridSize2, OFFSET_X2, OFFSET_Y2) {
    this.ctx = ctx2;
    this.ctxTracks = ctxTracks2;
    this.ctxTemp = ctxTemp2;
    this.canvasWidth = ctx2.canvas.width;
    this.canvasHeight = ctx2.canvas.height;
    this.canvasDemoTracksWidth = ctxDemoTracks2.canvas.width;
    this.canvasDemoTracksHeight = ctxDemoTracks2.canvas.height;
    this.gridSize = gridSize2;
    this.ctxDemoTracks = ctxDemoTracks2;
    this.OFFSET_X = OFFSET_X2;
    this.OFFSET_Y = OFFSET_Y2;
    this.trains = [];
    this.Flyovers = new Flyovers2(ctxTracks2, gridSize2, OFFSET_X2, OFFSET_Y2);
    this.ticksPerTimeUnit = 1e4;
    this.totalTimeUnits = 100;
    this.financials = new Financials(this.totalTimeUnits);
    this.population = new Population(ctx2.canvas.width, ctx2.canvas.height, gridSize2);
    this.travelPopulation = new TravelPopulation(this.population, ctx2.canvas.width, ctx2.canvas.height, gridSize2);
    this.rawmaterials = new Rawmaterials(ctx2.canvas.width, ctx2.canvas.height, gridSize2);
    this.rawmaterialDemand = new RawmaterialDemand(ctx2.canvas.width, ctx2.canvas.height, gridSize2);
    this.rawmaterialSupply = new RawMaterialSupply(ctx2.canvas.width, ctx2.canvas.height, gridSize2);
    this.popups = new Popups();
    this.rawmaterialDemand.displayStatistics();
    this.maxTrains = 9;
    this.trainInfo = new TrainInfo(this.maxTrains, this.totalTimeUnits);
  }
  getTimeUnitDuration() {
    return this.getMinutesPerTimeUnit();
  }
  getInitialCash() {
    return Math.floor(Financials.CASH_IN_HAND / 1e6);
  }
  getMinutesPerTimeUnit() {
    return Math.ceil(this.ticksPerTimeUnit / (60 * 60));
  }
  getCashInHand() {
    return this.financials.cashInHand;
  }
  getCoachCost() {
    return this.financials.coachCost;
  }
  getEngineCost() {
    return this.financials.engineCost;
  }
  getEngineUpgradeCost() {
    return this.financials.engineUpgradeCost;
  }
  getStationCost() {
    return this.financials.stationCost;
  }
  getFlyoverCost() {
    return this.financials.FlyoverCost;
  }
  getCollisionCost() {
    return this.financials.collisionCost;
  }
  getTrackCostPerUnit() {
    return this.financials.trackCostPerUnit;
  }
  getCoachCapacity() {
    return Train.coachPassengerCapacity;
  }
  getFreightCapacity() {
    return Train.freightWagonCapacity;
  }
  getTotalTimeUnits() {
    return this.totalTimeUnits;
  }
  getMaxNumCoaches() {
    return Train.maxNumCoaches;
  }
  getMaxNumFreightWagons() {
    return Train.maxNumFreightWagons;
  }
  getMinNumFreightWagons() {
    return Train.minNumFreightWagons;
  }
  getMinNumCoaches() {
    return Train.minNumCoaches;
  }
  getFreightWagonCost() {
    return this.financials.coachCost;
  }
  getTrackCost(positions) {
    return Track.getTrackLength(positions) * this.getTrackCostPerUnit();
  }
  getCumProfit() {
    return this.financials.cumProfitByTrain.reduce((acc, profit) => acc + profit, 0);
  }
  getRank() {
    return 1;
  }
  getCurrentTimePeriod() {
    return Math.floor(globalThis.globalTicks / this.ticksPerTimeUnit);
  }
  getCurrentTimeIndex() {
    return this.getCurrentTimePeriod();
  }
  addCoach(trainNumber, numCoaches = 1) {
    const train = this.trains[trainNumber - 1];
    if (train) {
      train.addCoach(numCoaches);
      this.financials.buyCoach(this.getCurrentTimeIndex(), trainNumber, numCoaches);
    }
  }
  removeCoach(trainNumber, numCoaches = 1) {
    const train = this.trains[trainNumber - 1];
    if (train) {
      train.removeCoach(numCoaches);
    }
  }
  upgradeEngine(trainNumber) {
    const train = this.trains[trainNumber - 1];
    if (train) {
      train.upgradeEngine();
      document.querySelector(`#upgradeEngine${trainNumber}`).classList.add("upgraded");
    }
  }
  incrementCollisionCost(ticks, train1, train2) {
    this.financials.incrementCollisionCost(this.getCurrentTimeIndex(), train1, train2);
  }
  getFinancialSummary(ticks) {
    return this.financials.getFinancialSummary(this.getCurrentTimeIndex());
  }
  getFinancialSummaryByTrain(ticks) {
    return this.financials.getFinancialSummaryByTrain(this.getCurrentTimeIndex());
  }
  // addTrack(track) {
  //   this.tracks.add(track)
  // }
  setPossibleFlyoverLocations(locations) {
    this.Flyovers.setPossibleFlyoverLocations(locations);
  }
  addFlyover(row, col) {
    const flyover = new Flyover(row, col);
    this.Flyovers.addFlyover(flyover);
  }
  getNumberOfFlyovers() {
    return this.Flyovers.getAllFlyovers().length;
  }
  validateUniqueStationDistances(stations, trainNumber) {
    const seenDistances = /* @__PURE__ */ new Map();
    for (const station of stations) {
      const distance = station.distanceFromStart;
      if (seenDistances.has(distance)) {
        const firstStationName = seenDistances.get(distance);
        console.warn(
          `[Station Guard] Duplicate distanceFromStart (${distance}) for train ${trainNumber}: ${firstStationName} and ${station.name}`
        );
      } else {
        seenDistances.set(distance, station.name);
      }
    }
  }
  async addTrain(positions, numCoaches, delayBeforeStart = 0, intersections2, options = {}) {
    const overlapMatches = [];
    let useParallelTrack = false;
    let numSegments = 0;
    let autoAssignedLane = 0;
    for (const train2 of this.trains) {
      if (train2 === null) continue;
      const commonSegmentsMap = getCommonSegmentsMap(positions, train2.track?.positions);
      if (commonSegmentsMap.size > 0) {
        numSegments += commonSegmentsMap.size;
        overlapMatches.push({
          trainNumber: train2.trainNumber,
          commonSegmentsMap
        });
      }
    }
    if (numSegments > 0) {
      const overlappingTrains = overlapMatches.map((match) => match.trainNumber).join(", ");
      const cost = numSegments * this.financials.parallelTrackCostPerSegment;
      useParallelTrack = await this.promptUserForParallelTrack(numSegments, overlappingTrains, cost);
      if (useParallelTrack) {
        const overlapCountBySegment = /* @__PURE__ */ new Map();
        overlapMatches.forEach((match) => {
          match.commonSegmentsMap.forEach((segment, key) => {
            overlapCountBySegment.set(key, (overlapCountBySegment.get(key) ?? 0) + 1);
          });
        });
        const maxExistingLinesOnAnySegment = overlapCountBySegment.size > 0 ? Math.max(...overlapCountBySegment.values()) : 0;
        autoAssignedLane = maxExistingLinesOnAnySegment % 3;
        if (options.runningScriptedDemo !== true) {
          this.financials.incrementExpenses(this.getCurrentTimeIndex(), null, cost, "Parallel Track Cost");
        }
      }
    }
    if (options.trainType === "freight") {
      options = {
        //checking how the game looks without the visual length scale for freight trains. 
        // visualLengthScale: 0.35,
        visualLengthScale: 1,
        maxVisualCoaches: 18,
        color: "rgba(80,80,80,0.75)",
        ...options
      };
    }
    const nullIndex = this.trains.findIndex((train2) => train2 === null);
    let trainNumber;
    if (nullIndex !== -1) {
      trainNumber = nullIndex + 1;
    } else {
      trainNumber = this.trains.length + 1;
    }
    const firstPosition = positions[0];
    const lastPosition = positions[positions.length - 1];
    const trackCtx = options.runningScriptedDemo ? this.ctxDemoTracks : this.ctxTracks;
    const track = new Track(trackCtx, positions, "", this.gridSize, overlapMatches);
    if (firstPosition.x == lastPosition.x && firstPosition.y == lastPosition.y) {
      alert("The starting and ending positions are the same. Please choose different positions for the starting and ending points.");
      return;
    } else {
      track.addStation(createStation(this.canvasWidth, this.canvasHeight, trackCtx, firstPosition.x, firstPosition.y, this.gridSize, 0, trainNumber, 30));
      track.addStation(createStation(this.canvasWidth, this.canvasHeight, trackCtx, lastPosition.x, lastPosition.y, this.gridSize, 0, trainNumber, 30));
      intersections2.updateIntersectionsWithStationLocation(firstPosition.y / this.gridSize, firstPosition.x / this.gridSize, true);
      intersections2.updateIntersectionsWithStationLocation(lastPosition.y / this.gridSize, lastPosition.x / this.gridSize, true);
      if (!options.partOfInitialSetup && !options.runningScriptedDemo) {
        this.financials.addStation(this.getCurrentTimeIndex(), trainNumber);
        this.financials.addStation(this.getCurrentTimeIndex(), trainNumber);
      }
    }
    this.validateUniqueStationDistances(track.stations.getAllStations(), trainNumber);
    const colorConfig = this.TRAINCONFIG[(trainNumber - 1) % this.TRAINCONFIG.length];
    const color = options.color ?? colorConfig.Color;
    const trainName = options.trainName ?? colorConfig.defaultName;
    const train = new Train({
      ctx: this.ctx,
      ctxTemp: this.ctxTemp,
      track,
      color,
      numCoaches,
      trainName,
      delayBeforeStart,
      trainNumber,
      intersections: intersections2,
      financials: this.financials,
      travelPopulation: this.travelPopulation,
      rawMaterialDemand: this.rawmaterialDemand,
      rawMaterialSupply: this.rawmaterialSupply,
      getCurrentTimeIndex: () => this.getCurrentTimeIndex(),
      trainType: options.trainType,
      lane: options.lane ?? autoAssignedLane,
      visualLengthScale: options.visualLengthScale,
      maxVisualCoaches: options.maxVisualCoaches,
      // popups: this.popups,
      trainInfo: this.trainInfo,
      runningScriptedDemo: options.runningScriptedDemo ?? false
    });
    const length = track.getTotalLength();
    const currentTimeIndex = this.getCurrentTimeIndex();
    if (!options.partOfInitialSetup && !options.runningScriptedDemo) {
      this.financials.incrementTrackCost(currentTimeIndex, trainNumber, length);
      this.financials.buyEngine(currentTimeIndex, trainNumber);
      this.financials.buyCoach(currentTimeIndex, trainNumber, numCoaches);
    }
    this.trains[trainNumber - 1] = train;
    if (useParallelTrack) {
      overlapMatches.forEach((match) => {
        intersections2.allowTrainsForCommonSegments(match.commonSegmentsMap, [match.trainNumber, trainNumber]);
      });
    }
    const trainElement = document.querySelector(`#train${trainNumber}`);
    if (trainElement) {
      if (nullIndex !== -1) {
        trainElement.style.display = "block";
      } else {
        trainElement.style.display = "grid";
      }
      trainElement.style.backgroundColor = color;
      if (options.trainType === "freight") {
        const speedUpButton = document.querySelector(`#speedUpTrain${trainNumber}`);
        const slowDownButton = document.querySelector(`#slowDownTrain${trainNumber}`);
        if (speedUpButton) {
          speedUpButton.disabled = true;
          speedUpButton.style.cursor = "not-allowed";
        }
        if (slowDownButton) {
          slowDownButton.disabled = true;
          slowDownButton.style.cursor = "not-allowed";
        }
      }
    }
    return trainNumber;
  }
  async addFreightTrain(positions, numCoaches, delayBeforeStart, intersections2, options = {}) {
    return this.addTrain(positions, numCoaches, delayBeforeStart, intersections2, {
      trainType: "freight",
      // visualLengthScale: 0.35,
      visualLengthScale: 1,
      maxVisualCoaches: 18,
      color: "rgba(80,80,80,0.75)",
      ...options
    });
  }
  async addPassengerTrain(positions, numCoaches, delayBeforeStart, intersections2, options = {}) {
    return this.addTrain(positions, numCoaches, delayBeforeStart, intersections2, {
      trainType: "passenger",
      ...options
    });
  }
  startStopTrain(trainNumber) {
    if (trainNumber <= this.trains.length) {
      const el = document.querySelector(`#pauseTrain${trainNumber}`);
      if (el) {
        el.classList.toggle("fa-pause");
        el.classList.toggle("fa-play");
      }
      const train = this.trains[trainNumber - 1];
      train.startStop();
    }
  }
  setTrainLane(trainNumber, lane) {
    const train = this.trains[trainNumber - 1];
    if (train) {
      train.setLane(lane);
    }
  }
  draw() {
    this.trains.forEach((train, index) => {
      if (train) {
        train.draw();
      }
    });
  }
  hasOtherTrainStationAt(x, y, excludedTrainNumber) {
    return this.trains.some((otherTrain, index) => {
      if (!otherTrain) {
        return false;
      }
      const otherTrainNumber = index + 1;
      if (otherTrainNumber === excludedTrainNumber) {
        return false;
      }
      if (typeof otherTrain.track?.hasStation !== "function") {
        return false;
      }
      return otherTrain.track.hasStation(x, y);
    });
  }
  removeTrain(trainNumber) {
    console.log(`Removing train ${trainNumber} in game.removeTrain(), with number of trains: ${this.trains.length}`);
    if (trainNumber <= this.trains.length) {
      const train = this.trains[trainNumber - 1];
      const stationLocations = /* @__PURE__ */ new Set();
      if (train) {
        if (!train.isUserPaused()) {
          train.setUserPaused(true);
        }
        const stations = train.track?.stations?.getAllStations?.() ?? [];
        stations.forEach((station) => {
          stationLocations.add(`${station.x},${station.y}`);
        });
      }
      stationLocations.forEach((locationKey) => {
        const [xStr, yStr] = locationKey.split(",");
        const x = Number(xStr);
        const y = Number(yStr);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return;
        }
        if (!this.hasOtherTrainStationAt(x, y, trainNumber)) {
          train?.intersections?.updateIntersectionsWithStationLocation(
            y / this.gridSize,
            x / this.gridSize,
            false
          );
        }
      });
      this.trains[trainNumber - 1] = null;
      this.displayAllTracksAndStations();
      const trainElement = document.querySelector(`#train${trainNumber}`);
      if (trainElement) {
        trainElement.style = "display:none";
      }
      this.Flyovers.draw();
    }
  }
  displayAllTracksAndStations() {
    this.ctxTracks.clearRect(0, 0, this.ctxTracks.canvas.width, this.ctxTracks.canvas.height);
    this.trains.forEach((train) => {
      if (train) {
        train.track.drawUsingNewPositions();
        const stations = train.track.stations.getAllStations();
        stations.forEach((station) => {
          station.draw();
        });
      }
    });
  }
  addStation(trainNumber, x, y, name, stopDuration, options = {}) {
    if (trainNumber <= this.trains.length) {
      const train = this.trains[trainNumber - 1];
      const station = createStation(this.canvasWidth, this.canvasHeight, this.ctxTracks, x, y, this.gridSize, 0, trainNumber, stopDuration);
      train.addStation(station);
      train.intersections.updateIntersectionsWithStationLocation(y / this.gridSize, x / this.gridSize, true);
      if (!options.partOfInitialSetup && !options.runningScriptedDemo) {
        this.financials.addStation(this.getCurrentTimeIndex(), trainNumber);
      }
    }
  }
  deleteStationAt(trainNumber, x, y) {
    if (trainNumber <= this.trains.length) {
      const train = this.trains[trainNumber - 1];
      if (train) {
        const station = train.track.stations.getStationAt(x, y);
        if (station) {
          train.deleteStation(station);
          train.intersections.updateIntersectionsWithStationLocation(y / this.gridSize, x / this.gridSize, false);
          this.financials.deleteStation(this.getCurrentTimeIndex(), trainNumber);
          this.displayAllTracksAndStations();
        }
      }
    }
  }
  getCumFinancialSummaryByTrain() {
    return this.financials.getCumFinancialSummaryByTrain();
  }
  incrementTimeUnit() {
    this.rawmaterialSupply.incrementTimeUnit();
    this.rawmaterialDemand.incrementTimeUnit();
  }
  extendTrain(trainNumber, positionsForExtendTrain) {
    const train = this.trains[trainNumber - 1];
    if (train) {
      const stationLocation = train.extendTrain(positionsForExtendTrain);
      const station = createStation(this.canvasWidth, this.canvasHeight, this.ctxTracks, stationLocation.x, stationLocation.y, this.gridSize, 0, trainNumber, 30);
      train.addStation(station);
      train.intersections.updateIntersectionsWithStationLocation(stationLocation.y / this.gridSize, stationLocation.x / this.gridSize, true);
      this.financials.addStation(this.getCurrentTimeIndex(), trainNumber);
    }
  }
  async promptUserForParallelTrack(numSegments, overlappingTrains, cost) {
    if (numSegments == 0) {
      return false;
    }
    if (typeof window.swal === "undefined" || typeof window.swal.fire !== "function") {
      return false;
    }
    const result = await window.swal.fire({
      title: "Enable Parallel Track?",
      text: `The new train overlaps with existing train(s): ${overlappingTrains}. ${numSegments} segments overlap. Enabling parallel-track mode will add $${cost.toLocaleString("en-US")} to track costs. If you do not
      add parallel tracks, you will have to manually manage collisions.`,
      ...typeof window.getTrainIconSwalOptions === "function" ? window.getTrainIconSwalOptions() : { icon: "question" },
      showCancelButton: true,
      confirmButtonText: "Enable Parallel Track",
      cancelButtonText: "Manage Collisions Manually"
    });
    return result.isConfirmed === true;
  }
  getFlyovers() {
    return this.Flyovers.getAllFlyovers();
  }
  isParallelTrackEnabledForTrains(row, col, intersections2, trainNumber1, trainNumber2) {
    const enabled = intersections2.getAllowedTrainsAtCell(row, col).has(trainNumber1) && intersections2.getAllowedTrainsAtCell(row, col).has(trainNumber2);
    return enabled;
  }
};

// demo.js
function createDemoController(options) {
  const {
    CANVASWIDTH: CANVASWIDTH2,
    CANVASHEIGHT: CANVASHEIGHT2,
    ctxTracks: ctxTracks2,
    ctxDemoTracks: ctxDemoTracks2,
    ctxTrains,
    getPaused,
    setPaused,
    getRunningScriptedDemo,
    setRunningScriptedDemo,
    getGame,
    sendHotkey,
    removeTrain,
    overlayMessage = "Demo in progress: Turn on sound to hear the commentary. Also keyboard and mouse input are temporarily disabled."
  } = options;
  const dismissVisibleSwal = async ({ requireConfirm = false, waitForVisibleMs = 1500, pollIntervalMs = 50 } = {}) => {
    if (typeof window.swal === "undefined") {
      return false;
    }
    const hasVisibilityApi = typeof window.swal.isVisible === "function";
    if (hasVisibilityApi) {
      const maxChecks = Math.max(1, Math.floor(waitForVisibleMs / pollIntervalMs));
      let checks = 0;
      while (!window.swal.isVisible() && checks < maxChecks) {
        await delay(pollIntervalMs);
        checks++;
      }
      if (!window.swal.isVisible()) {
        return false;
      }
    }
    if (typeof window.swal.clickConfirm === "function") {
      window.swal.clickConfirm();
      return true;
    }
    if (requireConfirm) {
      return false;
    }
    if (typeof window.swal.close === "function") {
      window.swal.close();
      return true;
    }
    return false;
  };
  const shouldBlockUserInputDuringDemo = (event) => getRunningScriptedDemo() && event?.isTrusted === true;
  const blockUserInputDuringDemo = (event) => {
    if (!shouldBlockUserInputDuringDemo(event)) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopImmediatePropagation();
  };
  const blockedEventsDuringDemo = [
    "keydown",
    "keyup",
    "keypress",
    "click",
    "dblclick",
    "mousedown",
    "mouseup",
    "contextmenu",
    "pointerdown",
    "pointerup",
    "pointermove",
    "wheel",
    "touchstart",
    "touchmove",
    "touchend"
  ];
  blockedEventsDuringDemo.forEach((eventName) => {
    window.addEventListener(eventName, blockUserInputDuringDemo, true);
  });
  const demoInputLockOverlayId = "demoInputLockOverlay";
  const showDemoInputLockOverlay = () => {
    let overlayEl = document.getElementById(demoInputLockOverlayId);
    if (!overlayEl) {
      overlayEl = document.createElement("div");
      overlayEl.id = demoInputLockOverlayId;
      overlayEl.style.position = "fixed";
      overlayEl.style.top = "100px";
      overlayEl.style.left = "50%";
      overlayEl.style.transform = "translateX(-50%)";
      overlayEl.style.padding = "10px 16px";
      overlayEl.style.background = "rgba(245, 226, 10, 0.25)";
      overlayEl.style.color = "#fff";
      overlayEl.style.fontSize = "14px";
      overlayEl.style.fontWeight = "600";
      overlayEl.style.borderRadius = "8px";
      overlayEl.style.zIndex = "10001";
      overlayEl.style.pointerEvents = "none";
      overlayEl.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
      overlayEl.textContent = overlayMessage;
      document.body.appendChild(overlayEl);
    }
    overlayEl.style.display = "block";
  };
  const hideDemoInputLockOverlay = () => {
    const overlayEl = document.getElementById(demoInputLockOverlayId);
    if (overlayEl) {
      overlayEl.style.display = "none";
    }
  };
  const startScriptedDemoToAddTrainAndStation = async (points, stationPoints, delayMS = 3e3, deleteTrain = true) => {
    let gameWasRunning = false;
    setRunningScriptedDemo(true);
    showDemoInputLockOverlay();
    try {
      ctxDemoTracks2.clearRect(0, 0, CANVASWIDTH2, CANVASHEIGHT2);
      ctxTracks2.canvas.style.display = "none";
      ctxTrains.canvas.style.display = "none";
      ctxDemoTracks2.canvas.style.display = "block";
      document.getElementById("buttonGroup1").style.display = "none";
      document.getElementById("buttonGroup2").style.display = "none";
      document.getElementById("buttonGroup3").style.display = "none";
      document.getElementById("buttonGroup4").style.display = "none";
      document.getElementById("buttonGroup5").style.display = "none";
      document.getElementById("buttonGroup7").style.display = "none";
      await delay(1e3);
      gameWasRunning = !getPaused();
      if (gameWasRunning) {
        setPaused(true);
      }
      await speakAsync("This demo will guide you through adding a train and a few stations.");
      await delay(delayMS);
      await speakAsync("Press on the T key on your keyboard or click on the Train button (T) on the on-screen control panel to bring up the Train dialog box.");
      await delay(delayMS);
      sendHotkey("T");
      await speakAsync("Now click on the Start Track Spec. play button.");
      await delay(delayMS);
      const startNewTrainPlayBtn = document.querySelector("#startTrack");
      if (startNewTrainPlayBtn instanceof HTMLElement) {
        let didAnimate = await animateMouseFromCenterToElement(startNewTrainPlayBtn);
        if (!didAnimate || !getRunningScriptedDemo()) {
          console.error("Failed to animate mouse to the Start Track Spec. play button or the scripted demo is no longer running.");
          return;
        }
        startNewTrainPlayBtn.click();
        await speakAsync("This brings up an instructional message on the process that you must follow. You will read it and then click on OK");
        await delay(delayMS);
        await dismissVisibleSwal({ requireConfirm: true });
        await speakAsync("Now click on the starting point from where you want the train to begin.");
        await delay(delayMS);
        const canvasTempEl = document.querySelector("#canvas_temp");
        const targetRect = startNewTrainPlayBtn.getBoundingClientRect();
        const playLeft = targetRect.left;
        const playTop = targetRect.top;
        let { clientX: startX, clientY: startY } = convertFromCanvasToClientCoordinates(canvasTempEl, playLeft, playTop);
        let clientPoint = {};
        let didAnimateToCoordinates = false;
        for (let i = 0; i < points.length; i++) {
          await speakAsync("Click on the " + (i == 0 ? "starting" : "next") + " point of the route.");
          clientPoint = convertFromCanvasToClientCoordinates(canvasTempEl, points[i].x, points[i].y);
          didAnimateToCoordinates = await animateMouseFromStartToEndCoordinates(startX, startY, clientPoint.clientX, clientPoint.clientY);
          if (!didAnimateToCoordinates) {
            console.error("Failed to animate mouse to the specified coordinates");
            return false;
          }
          const clickEvent = new MouseEvent("click", { clientX: clientPoint.clientX, clientY: clientPoint.clientY, bubbles: true, cancelable: true });
          canvasTempEl.dispatchEvent(clickEvent);
          await delay(delayMS);
          startX = clientPoint.clientX;
          startY = clientPoint.clientY;
        }
        await delay(delayMS);
        await speakAsync("You can continue adding points to the route. However, let us assume that you have finished adding all the points and that it time to finalize the route and flag-off the train.");
        await delay(delayMS);
        await speakAsync("Select the type of train - passenger or freight and the number of coaches or wagons and then click on the flag-off icon to start the train.");
        await delay(delayMS);
        const flagOffBtn = document.querySelector("#flagOff");
        const flagOffBtnRect = flagOffBtn.getBoundingClientRect();
        const { clientX: endX4, clientY: endY4 } = convertFromCanvasToClientCoordinates(canvasTempEl, flagOffBtnRect.left, flagOffBtnRect.top);
        didAnimateToCoordinates = await animateMouseFromStartToEndCoordinates(startX, startY, endX4, endY4);
        if (!didAnimateToCoordinates || !getRunningScriptedDemo()) {
          console.error("Failed to animate mouse to flag-off button or the scripted demo is no longer running.");
          return;
        }
        flagOffBtn.click();
        const messages = [];
        messages.push("In the actual game you will see the train moving along the route you specified unless the game is in a paused state.");
        await delay(delayMS);
        for (const message of messages) {
          await speakAsync(message);
          await delay(delayMS);
        }
        const lastTrainNumber = getGame().trains.length;
        await speakAsync("Once you create a train, starting and ending stations are defined. But you can then add a station.");
        await delay(delayMS);
        await speakAsync("First step is to bring up the Stations dialog box by pressing the S key on your keyboard or by clicking on the S button in the green on-screen control panel.");
        await delay(delayMS);
        sendHotkey("S");
        await delay(delayMS);
        await speakAsync(`Since the train that you added is train number ${lastTrainNumber}, you should now see it listed in the Station Dialog box. You will click on the T${lastTrainNumber} entry to view all the points where a station can be added.`);
        await delay(delayMS);
        const stationContainer = document.querySelector("#stationFortrain");
        if (!stationContainer) {
          console.error("Station container not found");
          return;
        }
        const stationElement = document.querySelector(`[data-value="${lastTrainNumber}"][data-role="station-train"]`);
        if (!stationElement) {
          console.error(`Station element for train number ${lastTrainNumber} not found`);
          return;
        }
        didAnimate = await animateMouseFromCenterToElement(stationElement);
        if (!didAnimate || !getRunningScriptedDemo()) {
          console.error(`Failed to animate mouse to station element for train number ${lastTrainNumber} or the scripted demo is no longer running.`);
        }
        stationElement.click();
        await speakAsync("Now you can click on any of the green circles to add a new station at that location.");
        await speakAsync("You will be asked to confirm the addition of the new station. During this demo, it is assumed that you are confirming the addition of the station.");
        await speakAsync("You can repeat this process to add multiple stations.");
        await delay(delayMS);
        for (let i = 0; i < stationPoints.length; i++) {
          await speakAsync("Click on " + (i == 0 ? "first" : "next") + "point where you want to add a station.");
          clientPoint = convertFromCanvasToClientCoordinates(canvasTempEl, stationPoints[i].x, stationPoints[i].y);
          didAnimateToCoordinates = await animateMouseFromStartToEndCoordinates(startX, startY, clientPoint.clientX, clientPoint.clientY);
          if (!didAnimateToCoordinates) {
            console.error("Failed to animate mouse to the specified coordinates");
            return false;
          }
          const clickEvent = new MouseEvent("click", { clientX: clientPoint.clientX, clientY: clientPoint.clientY, bubbles: true, cancelable: true });
          canvasTempEl.dispatchEvent(clickEvent);
          await delay(3e3);
          await dismissVisibleSwal({ requireConfirm: true });
          await delay(delayMS);
          startX = clientPoint.clientX;
          startY = clientPoint.clientY;
        }
        await delay(delayMS);
        await speakAsync(`After adding the new stations, you can click again on T${lastTrainNumber} entry to turn-off the list of possible station locations.`);
        await speakAsync("This concludes the demo.");
        stationElement.click();
        if (!deleteTrain) {
          return lastTrainNumber;
        }
        removeTrain(lastTrainNumber);
        await delay(delayMS);
      }
    } finally {
      if (gameWasRunning) {
        setPaused(false);
      }
      ctxTracks2.canvas.style.display = "block";
      ctxTrains.canvas.style.display = "block";
      ctxDemoTracks2.canvas.style.display = "none";
      setRunningScriptedDemo(false);
      hideDemoInputLockOverlay();
    }
  };
  return {
    startScriptedDemoToAddTrainAndStation
  };
}

// script.js
globalThis.globalTicks = 0;
var collisionCount = 0;
var CANVASHEIGHT = 800 * 2;
var CANVASWIDTH = 1200 * 2;
var CANVASMARGIN = 0;
var OFFSET_X = 0;
var OFFSET_Y = 0;
var gridSize = 50;
var canvas_Trains = document.querySelector("#canvas_trains");
var ctx = canvas_Trains.getContext("2d");
var canvasGrid = document.querySelector("#canvas_grid");
var canvasDemoTracks = document.querySelector("#canvas_demo_tracks");
var canvasTracks = document.querySelector("#canvas_tracks");
var canvasResults = document.querySelector("#canvas_results");
var canvasMaps1 = document.querySelector("#canvas_maps1");
var canvasMaps2 = document.querySelector("#canvas_maps2");
var canvasMaps3 = document.querySelector("#canvas_maps3");
var canvasTemp = document.querySelector("#canvas_temp");
var ctxGrid = canvasGrid.getContext("2d");
var ctxDemoTracks = canvasDemoTracks.getContext("2d");
var ctxTracks = canvasTracks.getContext("2d");
var ctxResults = canvasResults.getContext("2d");
var ctxMaps1 = canvasMaps1.getContext("2d");
var ctxMaps2 = canvasMaps2.getContext("2d");
var ctxMaps3 = canvasMaps3.getContext("2d");
var ctxTemp = canvasTemp.getContext("2d");
canvasDemoTracks.height = canvasGrid.height = canvas_Trains.height = canvasTracks.height = canvasTemp.height = canvasResults.height = canvasMaps1.height = canvasMaps2.height = canvasMaps3.height = CANVASHEIGHT + CANVASMARGIN;
canvasDemoTracks.width = canvasGrid.width = canvas_Trains.width = canvasTracks.width = canvasTemp.width = canvasResults.width = canvasMaps1.width = canvasMaps2.width = canvasMaps3.width = CANVASWIDTH + CANVASMARGIN;
var paused = true;
var startTrack = false;
var startExtendTrain = false;
var startFlyover = false;
var startStation = false;
var runningScriptedDemo = false;
var selectedTrainNumberForStartStation = null;
var showingResults = false;
var showingInfo = false;
var showingHowToPlay = false;
var click_error = 20;
var validTrackPoints = /* @__PURE__ */ new Set();
var validStartingPoints = /* @__PURE__ */ new Set();
var collisionAnimations = /* @__PURE__ */ new Map();
var collisionAnimationFrameId = null;
var collisionAnimationDurationMs = 3e3;
var collisionClearRadius = 96;
var nextDistantSteamTick = 0;
function scheduleDistantSteamAmbience(origin = "loop", force = false, delay2 = 400 + Math.random() * 1200) {
  if (!audioManager.isEnabled()) {
    return;
  }
  if (!force && globalThis.globalTicks < nextDistantSteamTick) {
    return;
  }
  const ambientDelayMs = delay2;
  const options = {
    duration: 30 + Math.random() * 20,
    volume: 0.57 + Math.random() * 0.03,
    chuffRate: 4 + Math.random() * 0.8,
    pan: Math.random() * 2 - 1,
    withWhistle: Math.random() < 0.5
  };
  setTimeout(async () => {
    await audioManager.playDistantSteamTrain(options);
  }, ambientDelayMs);
  nextDistantSteamTick = globalThis.globalTicks + 1800 + Math.floor(Math.random() * 1600);
}
function setValidTrackPoints() {
  validTrackPoints.clear();
  for (let x = OFFSET_X; x <= CANVASWIDTH - OFFSET_X; x += gridSize) {
    for (let y = OFFSET_Y; y <= CANVASHEIGHT - OFFSET_Y; y += gridSize) {
      validTrackPoints.add(`${x},${y}`);
    }
  }
}
var intersections = new Intersections(CANVASWIDTH - OFFSET_X * 2, CANVASHEIGHT - OFFSET_Y * 2, gridSize, OFFSET_X, OFFSET_Y);
var game = new Game(ctx, ctxTracks, ctxTemp, ctxDemoTracks, gridSize, OFFSET_X, OFFSET_Y);
globalThis.hideTrains = (hide = true) => {
  if (typeof ctx !== "undefined") {
    ctx.canvas.style.display = hide ? "none" : "block";
  }
};
globalThis.hideDemoTracks = (hide = true) => {
  if (typeof ctxDemoTracks !== "undefined") {
    ctxDemoTracks.canvas.style.display = hide ? "none" : "block";
  }
};
globalThis.hideTracks = (hide = true) => {
  if (typeof ctxTracks !== "undefined") {
    ctxTracks.canvas.style.display = hide ? "none" : "block";
  }
};
window.setGameSoundEnabled = (enabled) => audioManager.setEnabled(enabled);
var allowPageUnload = false;
var GAME_RESTART_WARNING = "This will wipe out your progress in the game and restart from the beginning.";
window.allowGamePageUnload = (allowed = true) => {
  allowPageUnload = !!allowed;
  return allowPageUnload;
};
window.addEventListener("beforeunload", (event) => {
  if (allowPageUnload) {
    return;
  }
  event.preventDefault();
  event.returnValue = "Refreshing or leaving this page will wipe out your game progress and restart the game.";
});
var controlsRoot = document.querySelector("#controls");
var gameStageRoot = document.querySelector("#gameStage");
function fitGameUiToViewport() {
  if (!gameStageRoot) {
    return;
  }
  const designWidth = gameStageRoot.offsetWidth;
  const designHeight = gameStageRoot.offsetHeight;
  if (designWidth <= 0 || designHeight <= 0) {
    return;
  }
  const viewportPadding = 8;
  const availableWidth = Math.max(1, window.innerWidth - viewportPadding * 2);
  const availableHeight = Math.max(1, window.innerHeight - viewportPadding * 2);
  const scale = Math.min(availableWidth / designWidth, availableHeight / designHeight, 1);
  const offsetX = Math.max(viewportPadding, Math.floor((window.innerWidth - designWidth * scale) / 2));
  const offsetY = Math.max(viewportPadding, Math.floor((window.innerHeight - designHeight * scale) / 2));
  const transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  gameStageRoot.style.position = "fixed";
  gameStageRoot.style.left = "0";
  gameStageRoot.style.top = "0";
  gameStageRoot.style.transformOrigin = "top left";
  gameStageRoot.style.transform = transform;
  if (controlsRoot) {
    controlsRoot.style.position = "fixed";
    controlsRoot.style.left = "0";
    controlsRoot.style.top = "0";
    controlsRoot.style.transformOrigin = "top left";
    controlsRoot.style.transform = transform;
  }
}
window.addEventListener("resize", fitGameUiToViewport);
window.addEventListener("orientationchange", fitGameUiToViewport);
window.addEventListener("load", fitGameUiToViewport);
requestAnimationFrame(fitGameUiToViewport);
function blurFocusedControlElement() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && controlsRoot?.contains(activeElement)) {
    activeElement.blur();
  }
}
var getTrainIconSwalOptions = () => ({
  icon: "question",
  iconHtml: '<i class="fas fa-train" aria-hidden="true"></i>',
  customClass: {
    icon: "swal2-train-icon"
  }
});
window.getTrainIconSwalOptions = getTrainIconSwalOptions;
async function requestGameRestart(source = "restart") {
  const title = source === "refresh" ? "Refresh and restart game?" : "Restart game?";
  if (typeof window.swal !== "undefined" && typeof window.swal.fire === "function") {
    const result = await window.swal.fire({
      icon: "warning",
      title,
      text: GAME_RESTART_WARNING,
      showCancelButton: true,
      confirmButtonText: "Restart",
      cancelButtonText: "Cancel"
    });
    if (!result.isConfirmed) {
      return false;
    }
  } else {
    const confirmed = window.confirm(`${title}

${GAME_RESTART_WARNING}`);
    if (!confirmed) {
      return false;
    }
  }
  window.allowGamePageUnload(true);
  window.location.reload();
  return true;
}
window.restartGame = () => requestGameRestart("restart");
if (typeof window.swal !== "undefined" && typeof window.swal.fire === "function") {
  const originalSwalFire = window.swal.fire.bind(window.swal);
  window.swal.fire = (...args) => {
    blurFocusedControlElement();
    return originalSwalFire(...args);
  };
}
function initializeTrainControlWidgets(maxTrains = 9) {
  const container = document.querySelector("#trainControlsContainer");
  const template = document.querySelector("#trainControlTemplate");
  if (!container || !template) {
    return;
  }
  container.innerHTML = "";
  for (let trainNumber = 1; trainNumber <= maxTrains; trainNumber++) {
    const fragment = template.content.cloneNode(true);
    const trainControlEl = fragment.querySelector(".trainControl");
    if (!trainControlEl) {
      continue;
    }
    trainControlEl.id = `train${trainNumber}`;
    trainControlEl.setAttribute("onmousemove", `highlightTrainTrack(${trainNumber},event)`);
    trainControlEl.querySelector('[data-role="label"]').id = `lblTrain${trainNumber}`;
    trainControlEl.querySelector('[data-role="label"]').textContent = `T${trainNumber}`;
    trainControlEl.querySelector('[data-role="train-type"]').id = `lblTrainType${trainNumber}`;
    trainControlEl.querySelector('[data-role="train-type"]').textContent = `P`;
    const pauseEl = trainControlEl.querySelector('[data-role="pause"]');
    pauseEl.id = `pauseTrain${trainNumber}`;
    pauseEl.setAttribute("onclick", `startStopTrain(${trainNumber})`);
    const newCountEl = trainControlEl.querySelector('[data-role="new-count"]');
    newCountEl.id = `newCount${trainNumber}`;
    newCountEl.setAttribute("onchange", `updateNewCount(${trainNumber},event)`);
    newCountEl.setAttribute("onkeydown", `if(event.key==='Enter'||event.key==='Escape'){this.blur()}`);
    const upgradeEngineEl = trainControlEl.querySelector('[data-role="upgrade-engine"]');
    upgradeEngineEl.id = `upgradeEngine${trainNumber}`;
    upgradeEngineEl.setAttribute("onclick", `upgradeEngine(${trainNumber})`);
    const healthEl = trainControlEl.querySelector('[data-role="health"]');
    healthEl.id = `health${trainNumber}`;
    const extendEl = trainControlEl.querySelector('[data-role="extend"]');
    extendEl.id = `extendTrain${trainNumber}`;
    extendEl.setAttribute("onclick", `extendTrain(${trainNumber})`);
    const removeEl = trainControlEl.querySelector('[data-role="remove"]');
    removeEl.id = `removeTrain${trainNumber}`;
    removeEl.setAttribute("onclick", `removetrain(${trainNumber})`);
    const extensionControlsEl = trainControlEl.querySelector('[data-role="extension-controls"]');
    extensionControlsEl.id = `trainExtensionControls${trainNumber}`;
    const completeExtensionEl = trainControlEl.querySelector('[data-role="complete-extension"]');
    completeExtensionEl.id = `completeTrainExtension${trainNumber}`;
    completeExtensionEl.setAttribute("onclick", `completeTrainExtension(${trainNumber})`);
    const cancelExtensionEl = trainControlEl.querySelector('[data-role="cancel-extension"]');
    cancelExtensionEl.id = `cancelTrainExtension${trainNumber}`;
    cancelExtensionEl.setAttribute("onclick", `cancelTrainExtension(${trainNumber})`);
    container.appendChild(fragment);
  }
}
initializeTrainControlWidgets(game.maxTrains);
var collisionCostValueEls = document.querySelectorAll('[data-bind="collisionCostValue"]');
collisionCostValueEls.forEach((el) => {
  el.textContent = `$${game.getCollisionCost().toLocaleString("en-US")}`;
});
var flyoverCostValueEls = document.querySelectorAll('[data-bind="flyoverCost"]');
flyoverCostValueEls.forEach((el) => {
  el.textContent = `$${game.getFlyoverCost().toLocaleString("en-US")}`;
});
var stationCostValueEls = document.querySelectorAll('[data-bind="stationCost"]');
stationCostValueEls.forEach((el) => {
  el.textContent = `$${game.getStationCost().toLocaleString("en-US")}`;
});
var engineCostValueEls = document.querySelectorAll('[data-bind="engineCost"]');
engineCostValueEls.forEach((el) => {
  el.textContent = `$${game.getEngineCost().toLocaleString("en-US")}`;
});
var trackCostValueEls = document.querySelectorAll('[data-bind="trackCost"]');
trackCostValueEls.forEach((el) => {
  el.textContent = `$${game.getTrackCostPerUnit().toLocaleString("en-US")}`;
});
var coachCapacityValueEls = document.querySelectorAll('[data-bind="coachCapacity"]');
coachCapacityValueEls.forEach((el) => {
  el.textContent = `${game.getCoachCapacity().toLocaleString("en-US")}`;
});
var freightCapacityValueEls = document.querySelectorAll('[data-bind="freightCapacity"]');
freightCapacityValueEls.forEach((el) => {
  el.textContent = `${game.getFreightCapacity().toLocaleString("en-US")}`;
});
var totalTimeUnitsValueEls = document.querySelectorAll('[data-bind="totalTimeUnits"]');
totalTimeUnitsValueEls.forEach((el) => {
  el.textContent = `${game.getTotalTimeUnits().toLocaleString("en-US")}`;
});
var maxNumCoachesValueEls = document.querySelectorAll('[data-bind="maxNumCoaches"]');
maxNumCoachesValueEls.forEach((el) => {
  el.textContent = `${game.getMaxNumCoaches().toLocaleString("en-US")}`;
});
var maxNumFreightWagonsValueEls = document.querySelectorAll('[data-bind="maxNumFreightWagons"]');
maxNumFreightWagonsValueEls.forEach((el) => {
  el.textContent = `${game.getMaxNumFreightWagons().toLocaleString("en-US")}`;
});
var coachCostValueEls = document.querySelectorAll('[data-bind="coachCost"]');
coachCostValueEls.forEach((el) => {
  el.textContent = `$${game.getCoachCost().toLocaleString("en-US")}`;
});
var freightWagonCostValueEls = document.querySelectorAll('[data-bind="freightWagonCost"]');
freightWagonCostValueEls.forEach((el) => {
  el.textContent = `$${game.getFreightWagonCost().toLocaleString("en-US")}`;
});
var engineUpgradeCostValueEls = document.querySelectorAll('[data-bind="engineUpgradeCost"]');
engineUpgradeCostValueEls.forEach((el) => {
  el.textContent = `$${game.getEngineUpgradeCost().toLocaleString("en-US")}`;
});
var initialCashValueEls = document.querySelectorAll('[data-bind="initialCash"]');
initialCashValueEls.forEach((el) => {
  el.textContent = `$${game.getInitialCash().toLocaleString("en-US")}`;
});
var timeUnitDurationValueEls = document.querySelectorAll('[data-bind="timeUnitDuration"]');
timeUnitDurationValueEls.forEach((el) => {
  el.textContent = `${game.getTimeUnitDuration()}`;
});
var minNumCoachesValueEls = document.querySelectorAll('[data-bind="minCoaches"]');
minNumCoachesValueEls.forEach((el) => {
  el.textContent = `${game.getMinNumCoaches().toLocaleString("en-US")}`;
});
var minNumFreightWagonsValueEls = document.querySelectorAll('[data-bind="minFreightWagons"]');
minNumFreightWagonsValueEls.forEach((el) => {
  el.textContent = `${game.getMinNumFreightWagons().toLocaleString("en-US")}`;
});
var getMinNumCoaches = () => game.getMinNumCoaches();
var getMinNumFreightWagons = () => game.getMinNumFreightWagons();
var getMaxNumCoaches = () => game.getMaxNumCoaches();
var getMaxNumFreightWagons = () => game.getMaxNumFreightWagons();
var initializeDefaultTrains = async () => {
  const preconfiguredTrainStartStaggerTicks = 3;
  let positions = [
    { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 500 },
    { x: CANVASMARGIN + 1450, y: CANVASMARGIN + 500 },
    { x: CANVASMARGIN + 1450, y: CANVASMARGIN + 1e3 },
    { x: CANVASMARGIN + 1900, y: CANVASMARGIN + 1e3 }
  ];
  await game.addTrain(positions, 7, 0 * preconfiguredTrainStartStaggerTicks, intersections, { trainType: "passenger", partOfInitialSetup: true });
  positions = [
    { x: CANVASMARGIN + 250, y: CANVASMARGIN + 250 },
    { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 250 },
    { x: CANVASMARGIN + 1200, y: CANVASMARGIN + 500 }
  ];
  let trainNumber = await game.addTrain(
    positions,
    10,
    1 * preconfiguredTrainStartStaggerTicks,
    intersections,
    { trainType: "passenger", partOfInitialSetup: true }
  );
  positions = [
    { x: CANVASMARGIN + 1900, y: CANVASMARGIN + 200 },
    { x: CANVASMARGIN + 1900, y: CANVASMARGIN + 600 },
    { x: CANVASMARGIN + 300, y: CANVASMARGIN + 600 }
  ];
  trainNumber = await game.addFreightTrain(
    positions,
    15,
    2 * preconfiguredTrainStartStaggerTicks,
    intersections,
    { partOfInitialSetup: true }
  );
  game.addStation(trainNumber, 1800, 600, `S${trainNumber}1907`, 30, { partOfInitialSetup: true });
  game.addStation(trainNumber, 1450, 600, `S${trainNumber}1907`, 30, { partOfInitialSetup: true });
};
await initializeDefaultTrains();
var drawScene = () => {
  if (!paused) {
    if (globalThis.globalTicks % game.ticksPerTimeUnit === 0) {
      const currentTimeUnit = Math.floor(globalThis.globalTicks / game.ticksPerTimeUnit);
      ctxResults.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT);
      ctxResults.save();
      ctxResults.font = "600px Arial";
      ctxResults.fillStyle = "black";
      ctxResults.globalAlpha = 0.2;
      const textMetrics = ctxResults.measureText(`${currentTimeUnit}`);
      ctxResults.fillText(`${currentTimeUnit}`, CANVASWIDTH / 2 - textMetrics.width / 2, CANVASHEIGHT / 2 - textMetrics.actualBoundingBoxDescent / 2);
      ctxResults.restore();
      game.trains.forEach((train) => {
        if (train) {
          const startDelayMs = Math.random() * 2e4;
          setTimeout(() => {
            audioManager.playTrainHorn({
              trainNumber: train.trainNumber,
              baseFrequency: 320 + 10 * train.trainNumber,
              duration: 0.2,
              volume: 0.05
            });
            setTimeout(() => {
              audioManager.playTrainHorn({
                trainNumber: train.trainNumber,
                baseFrequency: 320 + 10 * train.trainNumber,
                duration: 2,
                volume: 0.05
              });
            }, 200);
          }, startDelayMs);
        }
      });
      scheduleDistantSteamAmbience("time-unit");
      if (currentTimeUnit === 100) {
        paused = true;
        swal.fire({
          title: "Game Ended",
          text: `The game has ended after ${game.totalTimeUnits} periods. 
           Your rank in the game is ${game.getRank()} based on the cumulative profit of your trains $${Math.floor(game.getCumProfit() / 1e6)} Million. 
           You can view the financial summary of your trains by pressing the R key for results.`,
          icon: "info",
          confirmButtonText: "OK"
        });
      }
      game.trains.forEach((train) => {
        if (!train) return;
        game.financials.incrementExpensesOfStationMaintenance(currentTimeUnit, train, train.getNumStations());
        const distanceTraveledInTimeUnit = train.consumeDistanceTraveledInTimeUnit();
        game.financials.incrementExpensesOfTrackMaintenance(currentTimeUnit, train, distanceTraveledInTimeUnit);
        game.financials.incrementExpensesOfEngineAndCoachesDepreciation(currentTimeUnit, train.trainNumber, train.getNumCoachesOrFreightWagons());
      });
      game.incrementTimeUnit();
    }
    if (globalThis.globalTicks % 100 === 0) {
      if (showingResults) {
        displayFinancialResults();
      }
    }
    ctx.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT);
    game.draw(false);
    ctx.font = "14px Arial";
    ctx.fillStyle = "black";
    ctx.fillText(`Ticks: ${globalThis.globalTicks}`, CANVASWIDTH - 150, 20);
    globalThis.globalTicks++;
  }
  requestAnimationFrame(drawScene);
};
drawScene();
window.addEventListener("load", () => {
  const startPausebutton = document.querySelector("#startPauseBtn");
  let positions = [];
  let showingPopulationMap = false;
  let showingRawmaterialsMap = false;
  let showingRawmaterialDemandMap = false;
  let positionsForExtendTrain = [];
  let activeTrainExtensionTrainNumber = null;
  const { startScriptedDemoToAddTrainAndStation } = createDemoController({
    CANVASWIDTH,
    CANVASHEIGHT,
    ctxTracks,
    ctxDemoTracks,
    ctxTrains: ctx,
    getPaused: () => paused,
    setPaused: (value) => {
      paused = value;
    },
    getRunningScriptedDemo: () => runningScriptedDemo,
    setRunningScriptedDemo: (value) => {
      runningScriptedDemo = value;
    },
    getGame: () => game,
    sendHotkey: (hotkey) => sendHotkeyToDocument(hotkey),
    removeTrain: (trainNumber) => {
      window.removetrain(trainNumber, false);
    }
  });
  const displayPossibleStationLocations = (trainNumber) => {
    const train = game.trains[trainNumber - 1];
    if (!train) {
      console.error(`Train with number ${trainNumber} not found`);
      return;
    }
    const possibleStationLocations = train.track.getPossibleStationLocations();
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
    possibleStationLocations.forEach((location) => {
      const pos = location?.location;
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
        return;
      }
      ctxTemp.beginPath();
      ctxTemp.moveTo(pos.x, pos.y);
      if (location.hasStation) {
        ctxTemp.fillStyle = "rgb(255,0,0)";
      } else {
        ctxTemp.fillStyle = "rgb(0,255,0)";
      }
      ctxTemp.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctxTemp.closePath();
      ctxTemp.fill();
      ctxTemp.strokeStyle = "rgb(0,0,0)";
      ctxTemp.lineWidth = 2;
      ctxTemp.beginPath();
      ctxTemp.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctxTemp.stroke();
      ctxTemp.restore();
      ctxTemp.save();
    });
  };
  const drawFilledCircle = (ctx2, x, y, radius, color) => {
    ctx2.save();
    ctx2.beginPath();
    ctx2.moveTo(x + radius, y);
    ctx2.arc(x, y, radius, 0, Math.PI * 2);
    ctx2.fillStyle = color;
    ctx2.closePath();
    ctx2.fill();
    ctx2.restore();
  };
  const drawHollowCircle = (ctx2, x, y, radius, color) => {
    ctx2.save();
    ctx2.beginPath();
    ctx2.moveTo(x + radius, y);
    ctx2.arc(x, y, radius, 0, Math.PI * 2);
    ctx2.strokeStyle = color;
    ctx2.stroke();
    ctx2.closePath();
    ctx2.restore();
  };
  const getActiveTrainExtensionTrainNumber = (fallbackTrainNumber = null) => {
    const resolvedTrainNumber = Number.isInteger(fallbackTrainNumber) ? fallbackTrainNumber : activeTrainExtensionTrainNumber;
    return Number.isInteger(resolvedTrainNumber) ? resolvedTrainNumber : null;
  };
  const clearTrainExtensionState = () => {
    startExtendTrain = false;
    positionsForExtendTrain = [];
    validStartingPoints.clear();
    activeTrainExtensionTrainNumber = null;
    document.querySelectorAll('[id^="trainExtensionControls"]').forEach((control) => {
      control.style.display = "none";
    });
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
  };
  const handleTrainHotkeys = (event) => {
    if (event.repeat || !event.code) return;
    const isKeyboardRefresh = event.code === "F5" || (event.ctrlKey || event.metaKey);
    if (isKeyboardRefresh) {
      event.preventDefault();
      void requestGameRestart("refresh");
      return;
    }
    if (event.code === "KeyA") {
      toggleSound();
      return;
    }
    if (!startTrack && !startExtendTrain && !startFlyover && !startStation && event.key === "Escape") {
      ctxMaps1.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
      ctxMaps2.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
      ctxMaps3.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
      return;
    }
    if (startTrack && event.key === "Escape") {
      if (positions.length > 0) {
        positions.pop();
        updateCanvasTemp(positions[positions.length - 1]?.x, positions[positions.length - 1]?.y);
      }
    }
    if (startExtendTrain && event.key === "Escape") {
      if (positionsForExtendTrain.length > 0) {
        positionsForExtendTrain.pop();
        updateCanvasTempForExtendTrain();
      }
    }
    if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") {
      return;
    }
    const isDigitKey = event.code.startsWith("Digit") || event.code.startsWith("Numpad");
    if (isDigitKey) {
      const trainNumber = Number.parseInt(event.key, 10);
      if (!Number.isInteger(trainNumber) || trainNumber < 1 || trainNumber > 9) return;
      game.startStopTrain(trainNumber);
    } else if (event.code === "KeyT") {
      const buttonGroup12 = document.querySelector("#buttonGroup1");
      if (buttonGroup12.style.display === "none") {
        buttonGroup12.style.display = "flex";
      } else {
        buttonGroup12.style.display = "none";
      }
    } else if (event.code === "KeyF") {
      const FlyoverControls = document.querySelector("#buttonGroup2");
      if (FlyoverControls.style.display === "none") {
        FlyoverControls.style.display = "flex";
      } else {
        FlyoverControls.style.display = "none";
      }
    } else if (event.code === "KeyS") {
      const StationControls = document.querySelector("#buttonGroup3");
      if (StationControls.style.display === "none") {
        StationControls.style.display = "flex";
      } else {
        StationControls.style.display = "none";
      }
      startStationSelection();
    } else if (event.code === "KeyX") {
      if (!showingPopulationMap) {
        const populationMap = game.population.getAll();
        const maxPopulation = Math.max(...populationMap.map((p) => p.population));
        const rMaxSquare = (gridSize / 2) ** 2;
        populationMap.forEach((p) => {
          const radiusSquare = rMaxSquare * (p.population / maxPopulation);
          const radius = 2 * Math.sqrt(radiusSquare);
          ctxMaps1.beginPath();
          ctxMaps1.arc(p.x, p.y, radius, 0, 2 * Math.PI);
          ctxMaps1.fillStyle = "rgba(0,255,0,0.5)";
          ctxMaps1.fill();
        });
      } else {
        ctxMaps1.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
      }
      showingPopulationMap = !showingPopulationMap;
    } else if (event.code === "KeyY") {
      if (!showingRawmaterialsMap) {
        const rawmaterialsMap = game.rawmaterialSupply.getAll();
        const maxRawmaterial = Math.max(...rawmaterialsMap.map((p) => p.rawmaterial));
        const rMaxSquare = gridSize ** 2;
        rawmaterialsMap.forEach((p) => {
          if (p.rawmaterial > 1e4) {
            const radiusSquare = rMaxSquare * (p.rawmaterial / maxRawmaterial);
            const radius = Math.sqrt(radiusSquare);
            ctxMaps2.beginPath();
            ctxMaps2.arc(p.x, p.y, radius, 0, 2 * Math.PI);
            ctxMaps2.fillStyle = "rgba(255,255,0,0.5)";
            ctxMaps2.fill();
            if (p.rawmaterial > 1e5) {
              const txt = `${Math.round(p.rawmaterial / 1e3)} K`;
              ctxMaps2.font = "15px Arial";
              ctxMaps2.fillStyle = "black";
              const textMetrics = ctxMaps2.measureText(txt);
              ctxMaps2.fillText(txt, p.x - textMetrics.width / 2, p.y + 10);
            }
          }
        });
      } else {
        ctxMaps2.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
      }
      showingRawmaterialsMap = !showingRawmaterialsMap;
    } else if (event.code === "KeyZ") {
      if (!showingRawmaterialDemandMap) {
        const rawmaterialDemandMap = game.rawmaterialDemand.getAll();
        const maxRawmaterialDemand = Math.max(...rawmaterialDemandMap.map((p) => p.rawmaterial));
        const rMaxSquare = (gridSize / 2) ** 3;
        rawmaterialDemandMap.forEach((p) => {
          if (p.rawmaterial !== 0) {
            const radiusSquare = rMaxSquare * (p.rawmaterial / maxRawmaterialDemand);
            const radius = Math.sqrt(radiusSquare);
            ctxMaps3.beginPath();
            ctxMaps3.arc(p.x, p.y, radius, 0, 2 * Math.PI);
            ctxMaps3.fillStyle = "rgba(0,0,255,0.5)";
            ctxMaps3.fill();
            ctxMaps3.font = "20px Arial";
            ctxMaps3.fillStyle = "white";
            const txt = `${Math.floor(p.rawmaterial / 1e3)} K`;
            const textMetrics = ctxMaps3.measureText(txt);
            ctxMaps3.fillText(txt, p.x - textMetrics.width / 2, p.y + 10);
          }
        });
      } else {
        ctxMaps3.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
      }
      showingRawmaterialDemandMap = !showingRawmaterialDemandMap;
    } else if (event.code === "KeyR") {
      const modal = document.querySelector("#buttonGroup4");
      if (!showingResults) {
        modal.style.display = "flex";
        displayFinancialResults();
      } else {
        modal.style.display = "none";
      }
      showingResults = !showingResults;
    } else if (event.code === "KeyI") {
      const modal = document.querySelector("#buttonGroup7");
      if (!showingInfo) {
        modal.style.display = "flex";
      } else {
        modal.style.display = "none";
      }
      showingInfo = !showingInfo;
    } else if (event.key === "?") {
      const modal = document.querySelector("#buttonGroup5");
      if (!showingHowToPlay) {
        modal.style.display = "flex";
      } else {
        modal.style.display = "none";
      }
      showingHowToPlay = !showingHowToPlay;
    } else if (event.code === "KeyP") {
      startPauseGame();
    } else if (event.code === "KeyA") {
      toggleSound();
    } else if (event.code === "KeyD") {
      const points = [];
      points.push({ x: 1200, y: 300 });
      points.push({ x: 500, y: 300 });
      points.push({ x: 500, y: 850 });
      const stationPoints = [];
      stationPoints.push({ x: 1e3, y: 300 });
      stationPoints.push({ x: 500, y: 700 });
      startScriptedDemoToAddTrainAndStation(points, stationPoints, 500);
    }
  };
  startPausebutton.addEventListener("click", () => {
    startPauseGame();
  });
  const soundControlEl = document.querySelector("#soundControl");
  const soundControlLabelEl = document.querySelector("#soundControlLabel");
  const soundControlIconEl = soundControlEl?.querySelector("i");
  const updateSoundControlUI = (enabled = audioManager.isEnabled()) => {
    if (soundControlLabelEl) {
      soundControlLabelEl.textContent = enabled ? "Audio: On" : "Audio: Off";
    }
    if (soundControlIconEl) {
      soundControlIconEl.classList.toggle("fa-volume-up", enabled);
      soundControlIconEl.classList.toggle("fa-volume-mute", !enabled);
      soundControlIconEl.title = enabled ? "Audio On (press A to mute)" : "Audio Off (press A to unmute)";
    }
    if (soundControlEl) {
      soundControlEl.setAttribute("aria-pressed", String(enabled));
    }
  };
  updateSoundControlUI();
  const toggleSound = async () => {
    const enabled = audioManager.toggleSound();
    if (enabled && !audioManager.isUnlocked()) {
      await audioManager.unlockAudio();
    }
    updateSoundControlUI(enabled);
    const audioEnabledEl = document.querySelector("#audio_is_on");
    const audioDisabledEl = document.querySelector("#audio_is_off");
    if (audioEnabledEl) {
      audioEnabledEl.style.display = enabled ? "inline" : "none";
    }
    if (audioDisabledEl) {
      audioDisabledEl.style.display = enabled ? "none" : "inline";
    }
    return enabled;
  };
  const normalizeSmokeLevel = (level) => {
    const value = typeof level === "string" ? level.toLowerCase() : "high";
    if (value === "off" || value === "low" || value === "high") {
      return value;
    }
    return "high";
  };
  let currentSmokeLevel = "high";
  const smokeLevelControlEl = document.querySelector("#smokeLevelControl");
  const applySmokeLevelToTrains = (level) => {
    const normalized = normalizeSmokeLevel(level);
    game.trains.forEach((train) => {
      if (!train) {
        return;
      }
      if (typeof train.setSmokeSetting === "function") {
        train.setSmokeSetting(normalized);
      } else {
        train.smokeSetting = normalized;
      }
    });
    return normalized;
  };
  const updateSmokeControlUI = (level = currentSmokeLevel) => {
    if (smokeLevelControlEl) {
      smokeLevelControlEl.value = normalizeSmokeLevel(level);
    }
  };
  window.setTrainSmokeLevel = (level) => {
    currentSmokeLevel = applySmokeLevelToTrains(level);
    updateSmokeControlUI(currentSmokeLevel);
    return currentSmokeLevel;
  };
  if (smokeLevelControlEl) {
    smokeLevelControlEl.addEventListener("change", (event) => {
      window.setTrainSmokeLevel(event.target.value);
    });
  }
  window.setTrainSmokeLevel(currentSmokeLevel);
  const startPauseGame = () => {
    const wasPaused = paused;
    const startPauseButton = document.querySelector("#startPauseBtn");
    if (startPauseButton.classList.contains("fa-play")) {
      startPauseButton.classList.remove("fa-play");
      startPauseButton.classList.add("fa-pause");
    } else {
      startPauseButton.classList.remove("fa-pause");
      startPauseButton.classList.add("fa-play");
    }
    paused = !paused;
    if (!wasPaused && paused) {
      audioManager.pauseAllAudio().then(() => {
      });
      return;
    }
    if (wasPaused && !paused) {
      audioManager.resumeAllAudio().then((resumed) => {
      });
      audioManager.unlockAudio().then((unlocked) => {
        scheduleDistantSteamAmbience("resume", true);
      });
    }
  };
  document.addEventListener("keydown", handleTrainHotkeys);
  const hotkeyCodeMap = {
    "?": "Slash",
    "P": "KeyP",
    "T": "KeyT",
    "S": "KeyS",
    "F": "KeyF",
    "R": "KeyR",
    "I": "KeyI",
    "X": "KeyX",
    "Y": "KeyY",
    "Z": "KeyZ",
    "A": "KeyA",
    "D": "KeyD"
  };
  const sendHotkeyToDocument = (hotkey) => {
    const normalizedHotkey = hotkey === "?" ? "?" : String(hotkey).toUpperCase();
    const code = hotkeyCodeMap[normalizedHotkey];
    if (!code) return;
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: normalizedHotkey,
      code,
      repeat: false,
      bubbles: true,
      cancelable: true
    }));
  };
  document.querySelectorAll("#buttonGroup6 [data-hotkey]").forEach((button) => {
    button.addEventListener("click", () => {
      const hotkey = (button.getAttribute("data-hotkey") || "").toUpperCase();
      const normalizedHotkey = hotkey === "?" ? "?" : hotkey;
      sendHotkeyToDocument(normalizedHotkey);
    });
  });
  const restartGameBtn = document.querySelector("#restartGameBtn");
  if (restartGameBtn) {
    restartGameBtn.addEventListener("click", () => {
      void requestGameRestart("restart");
    });
  }
  const getCanvasPoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / rect.width;
    const scaleY = event.currentTarget.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };
  const typeOfTrain = document.getElementById("typeoftrain");
  if (typeOfTrain) {
    typeOfTrain.addEventListener("change", (event) => {
      if (event.target.value == "passenger") {
        document.querySelectorAll(".freightTrainControls").forEach((el) => el.style.display = "none");
        document.querySelectorAll(".passengerTrainControls").forEach((el) => el.style.display = "block");
        document.querySelector("span.passengerTrainControls").innerHTML = `Coaches:(${getMinNumCoaches()}-${getMaxNumCoaches()})`;
        const inputEl = document.getElementById("numcoaches");
        inputEl.min = getMinNumCoaches();
        inputEl.max = getMaxNumCoaches();
        inputEl.title = `# of Coaches (${getMinNumCoaches()}-${getMaxNumCoaches()})`;
      } else if (event.target.value == "freight") {
        document.querySelectorAll(".passengerTrainControls").forEach((el) => el.style.display = "none");
        document.querySelectorAll(".freightTrainControls").forEach((el) => el.style.display = "block");
        document.querySelector("span.freightTrainControls").innerHTML = `Wagons:(${getMinNumFreightWagons()}-${getMaxNumFreightWagons()})`;
        const inputEl = document.getElementById("numfreightwagons");
        inputEl.min = getMinNumFreightWagons();
        inputEl.max = getMaxNumFreightWagons();
        inputEl.title = `# Freight Wagons (${getMinNumFreightWagons()}-${getMaxNumFreightWagons()})`;
      }
    });
  }
  typeOfTrain.dispatchEvent(new Event("change", { target: { value: "passenger" } }));
  const infoForTrainContainer = document.querySelector("#infoForTrain");
  if (infoForTrainContainer) {
    infoForTrainContainer.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.tagName !== "DIV") {
        return;
      }
      const trainNumber = Number.parseInt(target.dataset.value, 10);
      if (!Number.isInteger(trainNumber)) {
        return;
      }
      document.querySelectorAll('[id^="infotrainoperations"]').forEach((el) => el.style.display = "none");
      const infoTrainOperationsElement = document.querySelector(`#infotrainoperations${trainNumber}`);
      if (infoTrainOperationsElement) {
        infoTrainOperationsElement.style.display = "block";
      }
    });
    infoForTrainContainer.addEventListener("mousemove", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.tagName !== "DIV") {
        return;
      }
      const trainNumber = Number.parseInt(target.dataset.value, 10);
      if (!Number.isInteger(trainNumber)) {
        return;
      }
      const train = game.trains[trainNumber - 1];
      if (!train) {
        return;
      }
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
      train.track.drawUsingNewPositions(ctxTemp, "rgba(255, 255, 0, 0.5)", 7);
    });
    infoForTrainContainer.addEventListener("mouseleave", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.tagName !== "DIV") {
        return;
      }
      const trainNumber = Number.parseInt(target.dataset.value, 10);
      if (!Number.isInteger(trainNumber)) {
        return;
      }
      const train = game.trains[trainNumber - 1];
      if (!train) {
        return;
      }
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
    });
    infoForTrainContainer.addEventListener("mouseleave", (event) => {
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
    });
  }
  const stationForTrainContainer = document.querySelector("#stationFortrain");
  const clearStationHoverPreview = (force = false) => {
    if (force || !startStation) {
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
    }
  };
  const clearFlyoverPreview = (force = false) => {
    if (force || !startFlyover) {
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
    }
  };
  if (stationForTrainContainer) {
    stationForTrainContainer.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.tagName !== "SPAN") {
        return;
      }
      const trainNumber = Number.parseInt(target.dataset.value, 10);
      if (!Number.isInteger(trainNumber)) {
        return;
      }
      stationForTrainContainer.querySelectorAll("span").forEach((span) => span.classList.remove("selected"));
      target.classList.add("selected");
      const train = game.trains[trainNumber - 1];
      if (!train) {
        console.error(`Train with number ${trainNumber} not found`);
        return;
      }
      if (startStation && selectedTrainNumberForStartStation === trainNumber) {
        startStation = false;
        ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
        selectedTrainNumberForStartStation = null;
        return;
      }
      startStation = true;
      displayPossibleStationLocations(trainNumber);
      selectedTrainNumberForStartStation = trainNumber;
    });
    stationForTrainContainer.addEventListener("mousemove", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.tagName !== "SPAN") {
        return;
      }
      const trainNumber = Number.parseInt(target.dataset.value, 10);
      if (!Number.isInteger(trainNumber)) {
        return;
      }
      const train = game.trains[trainNumber - 1];
      if (!train) {
        console.error(`Train with number ${trainNumber} not found`);
        return;
      }
      if (!startStation) {
        ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
        train.track.drawUsingNewPositions(ctxTemp, "rgba(255, 255, 0, 0.5)", 7);
      }
    });
    stationForTrainContainer.addEventListener("mouseleave", () => {
      clearStationHoverPreview();
    });
  }
  const startFlyoverBtn = document.querySelector("#startFlyoverBtn");
  if (startFlyoverBtn) {
    startFlyoverBtn.addEventListener("click", (event) => {
      startFlyover = true;
      const locations = getAllPossibleFlyoverLocations();
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
      locations.forEach((location) => {
        drawFilledCircle(ctxTemp, location.x, location.y, 20, "rgb(255, 255, 0)");
        drawHollowCircle(ctxTemp, location.x, location.y, 20, "black");
      });
    });
  }
  const cancelFlyoverBtn = document.querySelector("#cancelFlyoverBtn");
  if (cancelFlyoverBtn) {
    cancelFlyoverBtn.addEventListener("click", () => {
      startFlyover = false;
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
    });
  }
  document.querySelector("#canvas_temp").addEventListener("click", (event) => {
    const point = getCanvasPoint(event);
    if (startExtendTrain) {
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize;
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize;
      if (Math.abs(x - point.x) < click_error && Math.abs(y - point.y) < click_error) {
        if (positionsForExtendTrain.length === 0 && !validStartingPoints.has(`${x},${y}`)) {
          swal.fire({
            title: "Invalid Starting Point",
            text: `The point at (Row ${alpha(y / gridSize)}, Col ${alpha(x / gridSize)}) is not a valid starting point for track extension.`,
            icon: "error",
            confirmButtonText: "OK"
          });
          return;
        }
        if (positionsForExtendTrain.length > 0 && !validTrackPoints.has(`${x},${y}`)) {
          console.log(`Clicked at ${event.pageX},${event.pageY}, snapped to ${x},${y} but it's not a valid starting point`);
          swal.fire({
            title: "Invalid Point",
            text: `The point at (Row ${alpha(y / gridSize)}, Col ${alpha(x / gridSize)}) is not a valid point for track extension.`,
            icon: "error",
            confirmButtonText: "OK"
          });
          return;
        }
        if (positionsForExtendTrain.length > 1) {
          const lastPosition = positionsForExtendTrain[positionsForExtendTrain.length - 1];
          const secondLastPosition = positionsForExtendTrain[positionsForExtendTrain.length - 2];
          if (lastPosition.x === secondLastPosition.x && x === lastPosition.x) {
            positionsForExtendTrain.pop();
          }
          if (lastPosition.y === secondLastPosition.y && y === lastPosition.y) {
            positionsForExtendTrain.pop();
          }
        }
        positionsForExtendTrain.push({ x, y });
        updateCanvasTempForExtendTrain();
      }
    }
    if (startTrack) {
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize;
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize;
      if (Math.abs(x - point.x) < click_error && Math.abs(y - point.y) < click_error) {
        if (!validTrackPoints.has(`${x},${y}`)) {
          return;
        }
        if (positions.length > 1) {
          const lastPosition = positions[positions.length - 1];
          const secondLastPosition = positions[positions.length - 2];
          if (lastPosition.x === secondLastPosition.x && x === lastPosition.x) {
            positions.pop();
          }
          if (lastPosition.y === secondLastPosition.y && y === lastPosition.y) {
            positions.pop();
          }
        }
        positions.push({ x, y });
        updateCanvasTemp(x, y);
        document.querySelector("#flagOff").style.pointerEvents = "auto";
      }
    }
    if (startStation) {
      const selectedTrainNumber = Number.parseInt(document.querySelector("#stationFortrain span.selected")?.dataset.value, 10);
      if (!selectedTrainNumber) {
        swal.fire({
          title: "No Train Selected",
          text: "Please select a train before placing a station.",
          icon: "warning",
          confirmButtonText: "OK"
        });
        return;
      }
      const train = game.trains[selectedTrainNumber - 1];
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize;
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize;
      if (Math.abs(x - point.x) < click_error && Math.abs(y - point.y) < click_error) {
        const hasStation = train.track.hasStation(x, y);
        if (hasStation) {
          swal.fire({
            title: "Station Already Exists",
            text: "A station already exists at the selected location. Do you want to delete this station?",
            icon: "error",
            showCancelButton: true,
            confirmButtonText: "Yes",
            cancelButtonText: "No"
          }).then((result) => {
            if (result.isConfirmed) {
              game.deleteStationAt(selectedTrainNumber, x, y);
              game.displayAllTracksAndStations(drawGrid);
              displayPossibleStationLocations(selectedTrainNumber);
            }
          });
        } else {
          swal.fire({
            title: `Add Station for Train ${selectedTrainNumber}`,
            text: `Do you want to add a Station for Train ${selectedTrainNumber} at (Row ${alpha(y / gridSize)}, Col ${alpha(x / gridSize)})?`,
            ...getTrainIconSwalOptions(),
            showCancelButton: true,
            confirmButtonText: "Yes",
            cancelButtonText: "No"
          }).then((result) => {
            if (result.isConfirmed) {
              game.addStation(selectedTrainNumber, x, y, `S${selectedTrainNumber}${String(x / gridSize + 1).padStart(2, "0")}${String(y / gridSize + 1).padStart(2, "0")}`, 30, { runningScriptedDemo });
              game.displayAllTracksAndStations(drawGrid);
              displayPossibleStationLocations(selectedTrainNumber);
            }
          });
        }
      }
    }
    if (startFlyover) {
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize;
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize;
      if (Math.abs(x - point.x) < click_error && Math.abs(y - point.y) < click_error) {
        const possibleFlyoverLocations = getAllPossibleFlyoverLocations();
        const isValidFlyoverLocation = possibleFlyoverLocations.some((location) => location.x === x && location.y === y);
        if (!isValidFlyoverLocation) {
          swal.fire({
            title: "Invalid Flyover Location",
            text: "The selected location is not a valid flyover location for the selected train.",
            icon: "error",
            confirmButtonText: "OK"
          });
          return;
        }
        const flyovers = game.getFlyovers();
        const flyoverExists = flyovers.some((flyover) => flyover.col === x / gridSize && flyover.row === y / gridSize);
        if (flyoverExists) {
          swal.fire({
            title: "Flyover Already Exists",
            text: "A flyover already exists at the selected location.",
            icon: "error",
            confirmButtonText: "OK"
          });
          return;
        }
        swal.fire({
          title: `Add Flyover`,
          text: `Do you want to add a Flyover at (Row ${alpha(y / gridSize)}, Col ${alpha(x / gridSize)})?`,
          ...getTrainIconSwalOptions(),
          showCancelButton: true,
          confirmButtonText: "Yes",
          cancelButtonText: "No"
        }).then((result) => {
          if (result.isConfirmed) {
            const n = game.getNumberOfFlyovers();
            intersections.updateIntersectionsWithFlyoverLocation(y / gridSize, x / gridSize, true);
            game.addFlyover(y / gridSize, x / gridSize);
          } else {
          }
        });
      }
    }
  });
  document.querySelector("#canvas_temp").addEventListener("mousemove", (event) => {
    if (runningScriptedDemo) return;
    const point = getCanvasPoint(event);
    const row = alpha(Math.round((point.y - CANVASMARGIN) / gridSize));
    const col = alpha(Math.round((point.x - CANVASMARGIN) / gridSize));
    const buttonGroup8el = document.querySelector("#buttonGroup8");
    if (!buttonGroup8el) {
      return;
    }
    const label = buttonGroup8el.querySelector("span");
    if (!label) {
      return;
    }
    buttonGroup8el.style.display = "block";
    buttonGroup8el.style.left = `${event.clientX + 11}px`;
    buttonGroup8el.style.top = `${event.clientY + 15}px`;
    label.textContent = `${col},${row}`;
    if (startTrack) {
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize;
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize;
      if (Math.abs(x - point.x) < click_error && Math.abs(y - point.y) < click_error) {
        if (!validTrackPoints.has(`${x},${y}`)) {
          event.target.style = "cursor:default";
          return;
        }
        event.target.style = "cursor:pointer";
      } else {
        event.target.style = "cursor:default";
      }
    }
    if (startExtendTrain) {
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize;
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize;
      if (Math.abs(x - point.x) < click_error && Math.abs(y - point.y) < click_error) {
        if (!validTrackPoints.has(`${x},${y}`)) {
          event.target.style = "cursor:default";
          return;
        }
        event.target.style = "cursor:pointer";
      } else {
        event.target.style = "cursor:default";
      }
    }
    if (startFlyover) {
      const x = CANVASMARGIN + Math.round((point.x - CANVASMARGIN) / gridSize) * gridSize;
      const y = CANVASMARGIN + Math.round((point.y - CANVASMARGIN) / gridSize) * gridSize;
      if (Math.abs(x - point.x) < click_error && Math.abs(y - point.y) < click_error) {
        event.target.style = "cursor:pointer";
      } else {
        event.target.style = "cursor:default";
      }
    }
  });
  document.querySelector("#startTrack").addEventListener("click", () => {
    startFlyover = false;
    startStation = false;
    startExtendTrain = false;
    startTrack = true;
    document.querySelector("#canvas_temp").style = "cursor:crosshair";
    setValidTrackPoints();
    positions = [];
  });
  window.cancelStation = function() {
    const stationElement = document.querySelector("#buttonGroup3");
    if (stationElement) {
      stationElement.style.display = "none";
    }
    startStation = false;
    document.querySelector("#canvas_temp").style = "cursor:default";
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
  };
  window.completeTrainExtension = function() {
    const selectedTrainNumber = getActiveTrainExtensionTrainNumber();
    if (!selectedTrainNumber) {
      swal.fire({
        title: "No Train Selected",
        text: "Please start a train extension before completing it.",
        icon: "warning",
        confirmButtonText: "OK"
      });
      return;
    }
    if (positionsForExtendTrain.length < 2) {
      swal.fire({
        title: "Invalid Track Extension",
        text: "Please select at least two valid track points to extend the train. The first of these is the terminal station. If you do not want to extend the train then click on the Cross Icon in the Train Extension Controls to cancel the extension process.",
        icon: "warning",
        confirmButtonText: "OK"
      });
      return;
    }
    game.extendTrain(selectedTrainNumber, positionsForExtendTrain);
    console.log(`Completing extension for train ${selectedTrainNumber}`);
    clearTrainExtensionState();
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
  };
  const startStationSelection = function() {
    startFlyover = false;
    startTrack = false;
    if (stationForTrainContainer) {
      stationForTrainContainer.style.display = "block";
    }
    document.querySelector("#canvas_temp").style = "cursor:pointer";
  };
  window.cancelFlyover = function() {
    startFlyover = false;
    document.querySelector("#canvas_temp").style = "cursor:default";
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
  };
  window.setPossibleFlyoverLocations = function() {
    const possibleLocations = [];
    game.trains.forEach((train, index) => {
      train.track.possibleFlyoverLocations.forEach((location) => {
        possibleLocations.forEach((possibleLocation) => {
          if (possibleLocation.location.x === location.x && possibleLocation.location.y === location.y && possibleLocation.index !== index) {
            possibleLocation.count++;
          }
        });
        possibleLocations.push({ location, index, count: 1 });
      });
    });
    Flyovers.setPossibleFlyoverLocations(possibleLocations.map((location) => location.location));
  };
  drawGrid(ctxGrid);
  const updateValidTrackPreview = (pathPositions, options = {}) => {
    const {
      pointColor = "blue",
      firstStepAnchor = null,
      drawTrackPreview = false
    } = options;
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
    pathPositions.forEach((position) => {
      const { x, y } = position;
      drawFilledCircle(ctxTemp, x, y, 7, pointColor);
    });
    validTrackPoints.clear();
    if (pathPositions.length === 0) {
      return;
    }
    const { x: last_x, y: last_y } = pathPositions[pathPositions.length - 1];
    let x_before_last_x = null;
    let y_before_last_y = null;
    if (pathPositions.length > 1) {
      x_before_last_x = pathPositions[pathPositions.length - 2].x;
      y_before_last_y = pathPositions[pathPositions.length - 2].y;
    } else if (firstStepAnchor) {
      x_before_last_x = firstStepAnchor.x;
      y_before_last_y = firstStepAnchor.y;
    }
    const lastRow = last_y / gridSize;
    const lastCol = last_x / gridSize;
    const increasingRow = y_before_last_y !== null && last_y > y_before_last_y;
    const decreasingRow = y_before_last_y !== null && last_y < y_before_last_y;
    const increasingCol = x_before_last_x !== null && last_x > x_before_last_x;
    const decreasingCol = x_before_last_x !== null && last_x < x_before_last_x;
    if (pathPositions.length === 1) {
      if (increasingRow || decreasingRow) {
        for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
          if (decreasingRow && row < lastRow - 1 || increasingRow && row > lastRow + 1) {
            drawHollowCircle(ctxTemp, last_x, row * gridSize, click_error, `rgb(9, 108, 2)`);
            validTrackPoints.add(`${last_x},${row * gridSize}`);
          }
        }
      } else if (increasingCol || decreasingCol) {
        for (let col = 0; col < CANVASWIDTH / gridSize; col++) {
          if (decreasingCol && col < lastCol - 1 || increasingCol && col > lastCol + 1) {
            drawHollowCircle(ctxTemp, col * gridSize, last_y, click_error, `rgb(9, 108, 2)`);
            validTrackPoints.add(`${col * gridSize},${last_y}`);
          }
        }
      } else {
        for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
          if (Math.abs(row - lastRow) >= 4) {
            drawHollowCircle(ctxTemp, last_x, row * gridSize, click_error, `rgb(9, 108, 2)`);
            validTrackPoints.add(`${last_x},${row * gridSize}`);
          }
        }
        for (let col = 0; col < CANVASWIDTH / gridSize; col++) {
          if (Math.abs(col - lastCol) >= 4) {
            drawHollowCircle(ctxTemp, col * gridSize, last_y, click_error, `rgb(9, 108, 2)`);
            validTrackPoints.add(`${col * gridSize},${last_y}`);
          }
        }
      }
      return;
    }
    if (increasingCol || decreasingCol) {
      if (Math.abs(lastCol - x_before_last_x / gridSize) >= 4 || pathPositions.length <= 2) {
        for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
          if (Math.abs(row - lastRow) < 4) {
            continue;
          }
          drawHollowCircle(ctxTemp, last_x, row * gridSize, click_error, `rgb(9, 108, 2)`);
          validTrackPoints.add(`${last_x},${row * gridSize}`);
        }
      }
      for (let col = 0; col < CANVASWIDTH / gridSize; col++) {
        if (increasingCol && col > lastCol || decreasingCol && col < lastCol) {
          drawHollowCircle(ctxTemp, col * gridSize, last_y, click_error, `rgb(9, 108, 2)`);
          validTrackPoints.add(`${col * gridSize},${last_y}`);
        }
      }
    }
    if (increasingRow || decreasingRow) {
      if (Math.abs(lastRow - y_before_last_y / gridSize) >= 4 || pathPositions.length <= 2) {
        for (let col = 0; col < CANVASWIDTH / gridSize; col++) {
          if (Math.abs(col - lastCol) < 4) {
            continue;
          }
          drawHollowCircle(ctxTemp, col * gridSize, last_y, click_error, `rgb(9, 108, 2)`);
          validTrackPoints.add(`${col * gridSize},${last_y}`);
        }
      }
      for (let row = 0; row < CANVASHEIGHT / gridSize; row++) {
        if (increasingRow && row > lastRow || decreasingRow && row < lastRow) {
          drawHollowCircle(ctxTemp, last_x, row * gridSize, click_error, `rgb(9, 108, 2)`);
          validTrackPoints.add(`${last_x},${row * gridSize}`);
        }
      }
    }
    if (increasingRow) {
      for (let row = y_before_last_y / gridSize + 2; row < lastRow; row++) {
        drawHollowCircle(ctxTemp, last_x, row * gridSize, click_error, `rgb(9, 108, 2)`);
        validTrackPoints.add(`${last_x},${row * gridSize}`);
      }
    }
    if (decreasingRow) {
      for (let row = y_before_last_y / gridSize - 2; row > lastRow; row--) {
        drawHollowCircle(ctxTemp, last_x, row * gridSize, click_error, `rgb(9, 108, 2)`);
        validTrackPoints.add(`${last_x},${row * gridSize}`);
      }
    }
    if (increasingCol) {
      for (let col = x_before_last_x / gridSize + 2; col < lastCol; col++) {
        drawHollowCircle(ctxTemp, col * gridSize, last_y, click_error, `rgb(9, 108, 2)`);
        validTrackPoints.add(`${col * gridSize},${last_y}`);
      }
    }
    if (decreasingCol) {
      for (let col = x_before_last_x / gridSize - 2; col > lastCol; col--) {
        drawHollowCircle(ctxTemp, col * gridSize, last_y, click_error, `rgb(9, 108, 2)`);
        validTrackPoints.add(`${col * gridSize},${last_y}`);
      }
    }
    if (drawTrackPreview) {
      const tempTrack = new Track(ctxTemp, pathPositions);
      tempTrack.draw();
    }
  };
  function updateCanvasTempForExtendTrain() {
    const el = document.querySelector("#buttonGroup1");
    if (!el) {
      return;
    }
    const trainNumber = Number.parseInt(el.dataset.extendingTrainNumber, 10);
    let firstStepAnchor = null;
    if (positionsForExtendTrain.length === 1) {
      const train = game.trains[trainNumber - 1];
      if (train) {
        if (train.track.positions[0].x === positionsForExtendTrain[0].x && train.track.positions[0].y === positionsForExtendTrain[0].y) {
          firstStepAnchor = {
            x: train.track.positions[1].x,
            y: train.track.positions[1].y
          };
        } else if (train.track.positions[train.track.positions.length - 1].x === positionsForExtendTrain[0].x && train.track.positions[train.track.positions.length - 1].y === positionsForExtendTrain[0].y) {
          firstStepAnchor = {
            x: train.track.positions[train.track.positions.length - 2].x,
            y: train.track.positions[train.track.positions.length - 2].y
          };
        }
      }
    }
    updateValidTrackPreview(positionsForExtendTrain, {
      pointColor: "orange",
      firstStepAnchor,
      drawTrackPreview: true
    });
  }
  function updateCanvasTemp() {
    updateValidTrackPreview(positions, {
      pointColor: "blue",
      drawTrackPreview: true
    });
  }
  window.addEventListener("collision", (event) => {
    audioManager.safePlay("beep");
    collisionCount++;
    const collisionAnimationStartedAt = displayCollision(event.col, event.row);
    game.incrementCollisionCost(globalThis.globalTicks, event.train1, event.train2);
    pauseBothTrains(event.train1, event.train2);
    setTimeout(() => {
      clearCollision(event.col, event.row, collisionAnimationStartedAt);
      showCustomAlert(`Collision detected between train ${event.train1} and train 
        ${event.train2} at intersection (${alpha(event.col)},${alpha(event.row)}).
        Trains will be out of service temporarily for repairs.`);
    }, 5e3);
    game.trains[event.train1 - 1].setDysfunctional(true);
    game.trains[event.train2 - 1].setDysfunctional(true);
  });
  window.startStopTrain = (trainnumber) => {
    game.startStopTrain(trainnumber);
  };
  window.extendTrain = (trainnumber) => {
    clearTrainExtensionState();
    activeTrainExtensionTrainNumber = trainnumber;
    const buttonGroup12 = document.querySelector("#buttonGroup1");
    buttonGroup12.dataset.extendingTrainNumber = trainnumber;
    const trainExtensionControlEl = document.querySelector(`#trainExtensionControls${trainnumber}`);
    if (trainExtensionControlEl) {
      trainExtensionControlEl.style.display = "flex";
    }
    const train = game.trains[trainnumber - 1];
    const stations = train.stations;
    const startStation2 = stations[0];
    const endStation = stations[stations.length - 1];
    validStartingPoints = /* @__PURE__ */ new Set();
    validStartingPoints.add(`${startStation2.x},${startStation2.y}`);
    validStartingPoints.add(`${endStation.x},${endStation.y}`);
    swal.fire({
      title: `Extend Train ${trainnumber}`,
      text: `Click on one of the two terminal stations of Train ${trainnumber} - (${startStation2.name} or ${endStation.name}). 
        These are the only valid stations from which you can extend the train. After clicking on the station, you will be guided to select other points on the grid to extend the track from that station. When you are done click on the check icon in the train control. If you want to cancel then click on the cross icon in the train control.`
    });
    startExtendTrain = true;
  };
  window.starttrack = () => {
    startTrack = true;
    const cancelTrackBtn = document.querySelector("#cancelTrack");
    if (cancelTrackBtn) {
      cancelTrackBtn.style.pointerEvents = "all";
      cancelTrackBtn.style.opacity = "1";
    }
    swal.fire({
      title: "Set Starting Point",
      text: `Click on the grid to set the starting point of the track. After that, you can continue to add more points to define the track. Since the train cannot make sharp turns you will be guided and you will
      only be able to add points (shown by green circles) that do not create sharp turns. When you are done, click on the check icon in the train control. If you want to cancel, click on the cross icon in the train control.`
    });
    document.querySelector("#canvas_temp").style = "cursor:pointer";
  };
  window.canceltrack = () => {
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
    if (startTrack) {
      startTrack = false;
      document.querySelector("#canvas_temp").style = "cursor:default";
      positions = [];
      setValidTrackPoints();
      const startTrackBtn = document.querySelector("#startTrack");
      if (startTrackBtn) {
        startTrackBtn.style.pointerEvents = "all";
        startTrackBtn.style.opacity = "1";
      }
      const cancelTrackBtn = document.querySelector("#cancelTrack");
      if (cancelTrackBtn) {
        cancelTrackBtn.style.pointerEvents = "none";
        cancelTrackBtn.style.opacity = "0.5";
      }
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
    }
  };
  window.toggleAudio = async () => {
    if (audioManager.isEnabled()) {
      await toggleSound();
      return;
    }
    audioManager.setEnabled(true);
    if (!audioManager.isUnlocked()) {
      await audioManager.unlockAudio();
    }
    updateSoundControlUI(true);
  };
  window.cancelTrainExtension = (trainnumber) => {
    const extendTrainEl = document.querySelector("#trainExtensionControls" + trainnumber);
    if (extendTrainEl) {
      extendTrainEl.style.display = "none";
    }
    clearTrainExtensionState();
  };
  window.removetrain = (trainnumber, confirm = true) => {
    const activeTrackCtx = runningScriptedDemo ? ctxDemoTracks : ctxTracks;
    if (!confirm) {
      activeTrackCtx.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
      if (activeTrackCtx === ctxTracks) {
        drawGrid(ctxTracks);
      }
      console.log(`Removing train ${trainnumber} in window.removetrain(${confirm})`);
      game.removeTrain(trainnumber);
      intersections.removeTrain(trainnumber);
      return;
    }
    swal.fire({
      title: `Remove Train T${trainnumber}`,
      text: `Are you sure you want to remove Train T${trainnumber}? This action cannot be undone. Also please note that 
      you will only recover the depreciated cost of coaches and engine but not the track.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, remove it!",
      cancelButtonText: "No, keep it"
    }).then((result) => {
      if (result.isConfirmed) {
        activeTrackCtx.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
        if (activeTrackCtx === ctxTracks) {
          drawGrid(ctxTracks);
        }
        game.removeTrain(trainnumber);
        intersections.removeTrain(trainnumber);
      }
    });
  };
  window.newtrain = async () => {
    if (positions.length < 2) {
      startTrack = false;
      if (positions.length === 1) {
        swal.fire(`You have specified a starting point and no ending point. To create a track, you need to specify at least two points.`);
      } else {
        swal.fire(`You have not specified any points for the track. To create a track, you need to specify at least two points.`);
      }
      document.querySelector("#startTrack").style.display = "block";
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
      return;
    }
    if (positions[0].x === positions[positions.length - 1].x && positions[0].y === positions[positions.length - 1].y) {
      startTrack = false;
      swal.fire(`The starting point and ending point of the track cannot be the same. Please specify different points for the track.`);
      document.querySelector("#startTrack").style.display = "block";
      ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
      return;
    }
    ctxTemp.clearRect(0, 0, CANVASWIDTH + CANVASMARGIN, CANVASHEIGHT + CANVASMARGIN);
    const numCoachesEl = document.querySelector("#numcoaches");
    const numFreightWagonsEl = document.querySelector("#numfreightwagons");
    const selectTrainTypeEl = document.querySelector("#typeoftrain");
    const trainType = selectTrainTypeEl?.value === "freight" ? "freight" : "passenger";
    const parsedNumCoaches = Number.parseInt(numCoachesEl?.value ?? "", 10);
    const parsedNumFreightWagons = Number.parseInt(numFreightWagonsEl?.value ?? "", 10);
    const passengerCoachCount = Number.isInteger(parsedNumCoaches) && parsedNumCoaches >= 0 ? parsedNumCoaches : 5;
    const freightWagonCount = Number.isInteger(parsedNumFreightWagons) && parsedNumFreightWagons >= 0 ? parsedNumFreightWagons : 30;
    const numCoaches = trainType === "freight" ? freightWagonCount : passengerCoachCount;
    const trackCost = game.getTrackCost(positions);
    const trainCost = trackCost + numCoaches * (trainType === "freight" ? game.getFreightWagonCost() : game.getCoachCost()) + game.getEngineCost() + 2 * game.getStationCost();
    if (trainCost > game.getCashInHand()) {
      swal.fire(`You do not have enough funds to add this train. You need $${trainCost.toLocaleString("en-US")} but you only have $${game.getCashInHand().toLocaleString("en-US")}.`);
      startTrack = false;
      document.querySelector("#startTrack").style.display = "block";
      return;
    }
    const createdTrainNumber = await game.addTrain(positions, numCoaches, 0, intersections, { trainType, runningScriptedDemo });
    if (!createdTrainNumber) {
      return;
    }
    applySmokeLevelToTrains(currentSmokeLevel);
    game.setPossibleFlyoverLocations();
    const startTrackBtn = document.querySelector("#startTrack");
    if (startTrackBtn) {
      startTrackBtn.style.pointerEvents = "all";
      startTrackBtn.style.opacity = "1";
    }
    const cancelTrackBtn = document.querySelector("#cancelTrack");
    if (cancelTrackBtn) {
      cancelTrackBtn.style.pointerEvents = "none";
      cancelTrackBtn.style.opacity = "0.5";
    }
    startTrack = false;
    const lblNumCoaches = document.querySelector(`#lblNumCoaches${createdTrainNumber}`);
    if (lblNumCoaches) {
      lblNumCoaches.textContent = numCoaches;
    }
    const flagOffIcon = document.querySelector("#flagOff");
    if (flagOffIcon) {
      flagOffIcon.style.pointerEvents = "none";
    }
    positions = [];
  };
  const trainTypeSelect = document.querySelector("#typeoftrain");
  const passengerCoachSection = document.querySelector("#numcoaches")?.closest("div");
  const freightWagonSection = document.querySelector("#numfreightwagons")?.closest("div");
  const syncTrainTypeInputs = () => {
    const isFreight = trainTypeSelect?.value === "freight";
    if (passengerCoachSection) {
      passengerCoachSection.hidden = isFreight;
    }
    if (freightWagonSection) {
      freightWagonSection.hidden = !isFreight;
    }
  };
  if (trainTypeSelect) {
    trainTypeSelect.addEventListener("change", syncTrainTypeInputs);
  }
  syncTrainTypeInputs();
  window.updateNewCount = (trainNumber, event) => {
    const train = game.trains[trainNumber - 1];
    if (!train || !event?.target) {
      return;
    }
    const countInput = event.target;
    const blurCountInput = () => {
      if (countInput instanceof HTMLElement) {
        countInput.blur();
      }
    };
    const oldValue = train.numCoaches;
    const newValue = Number.parseInt(countInput.value, 10);
    const minAllowed = 2;
    const maxAllowed = train.trainType === "freight" ? game.getMaxNumFreightWagons() : game.getMaxNumCoaches();
    if (!Number.isInteger(newValue) || newValue < minAllowed || newValue > maxAllowed) {
      countInput.value = oldValue;
      blurCountInput();
      return;
    }
    if (newValue === oldValue) {
      blurCountInput();
      return;
    }
    if (newValue > oldValue) {
      game.addCoach(trainNumber, newValue - oldValue);
      blurCountInput();
      return;
    }
    game.removeCoach(trainNumber, oldValue - newValue);
    blurCountInput();
  };
  window.closeflyover = () => {
    const flyoverElement = document.querySelector("#buttonGroup2");
    if (flyoverElement) {
      flyoverElement.style.display = "none";
      startFlyover = false;
    }
  };
  window.clearTempCanvas = function() {
    if (runningScriptedDemo || startTrack || startExtendTrain || startStation || startFlyover) return;
    ctxTemp.clearRect(0, 0, ctxTemp.canvas.width, ctxTemp.canvas.height);
  };
  window.highlightTrainTrack = function(trainNumber, event) {
    if (runningScriptedDemo || startTrack || startExtendTrain || startStation || startFlyover) return;
    const train = game.trains[trainNumber - 1];
    if (!train) {
      console.error(`Train with number ${trainNumber} not found`);
      return;
    }
    if (!startTrack && !startExtendTrain && !startStation && !startFlyover) {
      ctxTemp.clearRect(0, 0, ctxTemp.canvas.width, ctxTemp.canvas.height);
      train.track.drawUsingNewPositions(ctxTemp, "rgba(255, 255, 0, 0.5)", 7);
    }
  };
  window.addCoach = function(trainNumber) {
    const train = game.trains[trainNumber - 1];
    if (!train) {
      console.error(`Train with number ${trainNumber} not found`);
      return;
    }
    const additionalAddPassengerEl = document.querySelector(`#additionalAddPassenger${trainNumber}`);
    const additionalAddFreightEl = document.querySelector(`#additionalAddFreight${trainNumber}`);
    const additionalSubtractPassengerEl = document.querySelector(`#additionalSubtractPassenger${trainNumber}`);
    const additionalSubtractFreightEl = document.querySelector(`#additionalSubtractFreight${trainNumber}`);
    if (train.trainType === "passenger") {
      if (additionalAddPassengerEl) {
        additionalAddPassengerEl.style.display = "flex";
        setTimeout(() => {
          additionalAddPassengerEl.style.display = "none";
        }, 5e3);
      }
      if (additionalAddFreightEl) {
        additionalAddFreightEl.style.display = "none";
      }
      if (additionalSubtractPassengerEl) {
        additionalSubtractPassengerEl.style.display = "none";
      }
      if (additionalSubtractFreightEl) {
        additionalSubtractFreightEl.style.display = "none";
      }
    } else if (train.trainType === "freight") {
      if (additionalAddPassengerEl) {
        additionalAddPassengerEl.style.display = "none";
      }
      if (additionalAddFreightEl) {
        additionalAddFreightEl.style.display = "flex";
        setTimeout(() => {
          additionalAddFreightEl.style.display = "none";
        }, 5e3);
      }
      if (additionalSubtractPassengerEl) {
        additionalSubtractPassengerEl.style.display = "none";
      }
      if (additionalSubtractFreightEl) {
        additionalSubtractFreightEl.style.display = "none";
      }
    }
  };
  window.removeCoach = function(trainNumber) {
    const train = game.trains[trainNumber - 1];
    if (!train) {
      console.error(`Train with number ${trainNumber} not found`);
      return;
    }
    const additionalAddPassengerEl = document.querySelector(`#additionalAddPassenger${trainNumber}`);
    const additionalAddFreightEl = document.querySelector(`#additionalAddFreight${trainNumber}`);
    const additionalSubtractPassengerEl = document.querySelector(`#additionalSubtractPassenger${trainNumber}`);
    const additionalSubtractFreightEl = document.querySelector(`#additionalSubtractFreight${trainNumber}`);
    if (train.trainType === "passenger") {
      if (additionalAddPassengerEl) {
        additionalAddPassengerEl.style.display = "none";
      }
      if (additionalAddFreightEl) {
        additionalAddFreightEl.style.display = "none";
      }
      if (additionalSubtractPassengerEl) {
        additionalSubtractPassengerEl.style.display = "flex";
        setTimeout(() => {
          additionalSubtractPassengerEl.style.display = "none";
        }, 5e3);
      }
      if (additionalSubtractFreightEl) {
        additionalSubtractFreightEl.style.display = "none";
      }
    } else if (train.trainType === "freight") {
      if (additionalAddPassengerEl) {
        additionalAddPassengerEl.style.display = "none";
      }
      if (additionalAddFreightEl) {
        additionalAddFreightEl.style.display = "none";
      }
      if (additionalSubtractPassengerEl) {
        additionalSubtractPassengerEl.style.display = "none";
      }
      if (additionalSubtractFreightEl) {
        additionalSubtractFreightEl.style.display = "flex";
        setTimeout(() => {
          additionalSubtractFreightEl.style.display = "none";
        }, 5e3);
      }
    }
  };
  window.upgradeEngine = function(trainNumber) {
    const costOfUpgrade = game.getEngineUpgradeCost();
    swal.fire({
      title: `Upgrade Engine for Train ${trainNumber}`,
      text: `Upgrading the engine will increase the speed of the train. This will allow the train to move faster and reduce the travel time between stations. 
    However, this will cost you $${costOfUpgrade.toLocaleString("en-US")}. Do you want to upgrade the engine?`,
      ...getTrainIconSwalOptions(),
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "No"
    }).then((result) => {
      if (result.isConfirmed) {
        game.upgradeEngine(trainNumber);
      }
    });
  };
  const buttonGroup1 = document.querySelector("#buttonGroup1");
  makeDraggable(buttonGroup1);
  const buttonGroup2 = document.querySelector("#buttonGroup2");
  makeDraggable(buttonGroup2);
  if (buttonGroup2) {
    const buttonGroup2Close = buttonGroup2.querySelector(".dialogClose");
    if (buttonGroup2Close) {
      buttonGroup2Close.addEventListener("click", () => {
        buttonGroup2.style.display = "none";
        clearFlyoverPreview(true);
      });
    }
  }
  const buttonGroup3 = document.querySelector("#buttonGroup3");
  makeDraggable(buttonGroup3);
  if (buttonGroup3) {
    const buttonGroup3Close = buttonGroup3.querySelector(".dialogClose");
    if (buttonGroup3Close) {
      buttonGroup3Close.addEventListener("click", () => {
        buttonGroup3.style.display = "none";
        clearStationHoverPreview(true);
      });
    }
  }
  const buttonGroup4 = document.querySelector("#buttonGroup4");
  makeDraggable(buttonGroup4);
  const buttonGroup5 = document.querySelector("#buttonGroup5");
  makeDraggable(buttonGroup5);
  const buttonGroup6 = document.querySelector("#buttonGroup6");
  makeDraggable(buttonGroup6);
  const buttonGroup7 = document.querySelector("#buttonGroup7");
  makeDraggable(buttonGroup7);
  const howToPlayStartBtn = document.getElementById("howToPlayStartBtn");
  if (howToPlayStartBtn) {
    howToPlayStartBtn.addEventListener("click", () => {
      sendHotkeyToDocument("P");
    });
  }
  const getAllGridLocations = function(trainNumber) {
    const train = game.trains[trainNumber - 1];
    if (!train) {
      console.error(`Train with number ${trainNumber} not found`);
      return [];
    }
    return train.getAllGridLocations();
  };
  const getAllPossibleFlyoverLocations = function() {
    const allLocations = [];
    for (const train of game.trains) {
      const locations = getAllGridLocations(train.trainNumber);
      for (const otherTrain of game.trains) {
        if (otherTrain.trainNumber === train.trainNumber) {
          continue;
        }
        const otherLocation = getAllGridLocations(otherTrain.trainNumber);
        for (const loc of locations) {
          for (const other of otherLocation) {
            if (loc.x === other.x && loc.y === other.y) {
              if (!game.isParallelTrackEnabledForTrains(loc.y / gridSize, loc.x / gridSize, intersections, train.trainNumber, otherTrain.trainNumber)) {
                if (!allLocations.some((l) => l.x === loc.x && l.y === loc.y)) {
                  allLocations.push(loc);
                }
              }
            }
          }
        }
      }
    }
    return allLocations;
  };
  sendHotkeyToDocument("?");
});
function displayCollision(col, row) {
  const x = OFFSET_X + col * gridSize;
  const y = OFFSET_Y + row * gridSize;
  const key = `${col},${row}`;
  const startedAt = performance.now();
  collisionAnimations.set(key, createCollisionAnimationState(x, y, startedAt));
  ensureCollisionAnimationLoop();
  return startedAt;
}
function clearCollision(col, row, startedAt) {
  const key = `${col},${row}`;
  if (startedAt != null) {
    const activeState = collisionAnimations.get(key);
    if (activeState && activeState.startedAt !== startedAt) {
      return;
    }
  }
  collisionAnimations.delete(key);
  const x = OFFSET_X + col * gridSize;
  const y = OFFSET_Y + row * gridSize;
  ctxTemp.clearRect(x - collisionClearRadius, y - collisionClearRadius, collisionClearRadius * 2, collisionClearRadius * 2);
}
function createCollisionAnimationState(x, y, startedAt) {
  const sparks = Array.from({ length: 14 }, (_, index) => {
    const angle = Math.PI * 2 * index / 14 + (Math.random() - 0.5) * 0.35;
    return {
      angle,
      speed: 0.08 + Math.random() * 0.08,
      size: 1.5 + Math.random() * 2.2,
      drag: 0.84 + Math.random() * 0.12,
      life: 0.55 + Math.random() * 0.35
    };
  });
  const smoke = Array.from({ length: 8 }, () => ({
    driftX: (Math.random() - 0.5) * 0.06,
    driftY: 0.04 + Math.random() * 0.05,
    radiusStart: 5 + Math.random() * 6,
    delay: Math.random() * 0.35
  }));
  return {
    x,
    y,
    startedAt,
    sparks,
    smoke
  };
}
function ensureCollisionAnimationLoop() {
  if (collisionAnimationFrameId !== null) return;
  const frame = (now) => {
    if (collisionAnimations.size === 0) {
      collisionAnimationFrameId = null;
      return;
    }
    collisionAnimations.forEach((state, key) => {
      const elapsed = now - state.startedAt;
      const t = Math.max(0, Math.min(1, elapsed / collisionAnimationDurationMs));
      if (t >= 1) {
        collisionAnimations.delete(key);
        ctxTemp.clearRect(state.x - collisionClearRadius, state.y - collisionClearRadius, collisionClearRadius * 2, collisionClearRadius * 2);
        return;
      }
      ctxTemp.clearRect(state.x - collisionClearRadius, state.y - collisionClearRadius, collisionClearRadius * 2, collisionClearRadius * 2);
      drawCollisionFrame(state, t);
    });
    collisionAnimationFrameId = requestAnimationFrame(frame);
  };
  collisionAnimationFrameId = requestAnimationFrame(frame);
}
function drawCollisionFrame(state, t) {
  const { x, y, sparks, smoke } = state;
  ctxTemp.save();
  const blastRadius = 10 + t * 28;
  const blastOpacity = Math.max(0, 0.95 - t * 1.1);
  const blastGradient = ctxTemp.createRadialGradient(x, y, 0, x, y, blastRadius);
  blastGradient.addColorStop(0, `rgba(255,255,185,${blastOpacity})`);
  blastGradient.addColorStop(0.35, `rgba(255,160,30,${blastOpacity * 0.95})`);
  blastGradient.addColorStop(1, `rgba(190,35,15,0)`);
  ctxTemp.beginPath();
  ctxTemp.fillStyle = blastGradient;
  ctxTemp.arc(x, y, blastRadius, 0, Math.PI * 2);
  ctxTemp.fill();
  const ringRadius = 8 + t * 78;
  const ringOpacity = Math.max(0, 0.8 - t * 0.9);
  ctxTemp.beginPath();
  ctxTemp.strokeStyle = `rgba(255,120,20,${ringOpacity})`;
  ctxTemp.lineWidth = 2 + (1 - t) * 3;
  ctxTemp.arc(x, y, ringRadius, 0, Math.PI * 2);
  ctxTemp.stroke();
  sparks.forEach((spark) => {
    const sparkT = Math.min(1, t / spark.life);
    if (sparkT >= 1) return;
    const travel = 68 * spark.speed * sparkT * (spark.drag + (1 - sparkT) * 0.6);
    const sx = x + Math.cos(spark.angle) * travel;
    const sy = y + Math.sin(spark.angle) * travel;
    const alpha2 = (1 - sparkT) * 0.95;
    ctxTemp.beginPath();
    ctxTemp.fillStyle = `rgba(255,220,100,${alpha2})`;
    ctxTemp.arc(sx, sy, spark.size * (1 - sparkT * 0.5), 0, Math.PI * 2);
    ctxTemp.fill();
  });
  smoke.forEach((puff) => {
    const smokeT = (t - puff.delay) / (1 - puff.delay);
    if (smokeT <= 0 || smokeT >= 1) return;
    const sx = x + puff.driftX * smokeT * 560;
    const sy = y - puff.driftY * smokeT * 560;
    const radius = puff.radiusStart + smokeT * 22;
    const alpha2 = (1 - smokeT) * 0.22;
    ctxTemp.beginPath();
    ctxTemp.fillStyle = `rgba(70,70,70,${alpha2})`;
    ctxTemp.arc(sx, sy, radius, 0, Math.PI * 2);
    ctxTemp.fill();
  });
  ctxTemp.restore();
}
function drawGrid(ctx2 = ctxTracks) {
  const numCols = (CANVASWIDTH - 0.5 * CANVASMARGIN) / gridSize;
  const numRows = (CANVASHEIGHT - 0.5 * CANVASMARGIN) / gridSize;
  ctx2.strokeStyle = "rgba(0,0,0,0.1)";
  ctx2.beginPath();
  for (let i = 0; i <= numCols; i++) {
    ctx2.moveTo(CANVASMARGIN + i * gridSize, CANVASMARGIN);
    ctx2.lineTo(CANVASMARGIN + i * gridSize, CANVASHEIGHT - CANVASMARGIN);
  }
  for (let j = 0; j <= numRows; j++) {
    ctx2.moveTo(CANVASMARGIN + 0, CANVASMARGIN + j * gridSize);
    ctx2.lineTo(CANVASWIDTH - CANVASMARGIN, CANVASMARGIN + j * gridSize);
  }
  ctx2.closePath();
  ctx2.stroke();
  ctx2.fillStyle = "black";
  ctx2.font = "12px Arial";
  for (let i = 0; i < numCols; i++) {
    ctx2.fillText(alpha(i), CANVASMARGIN + i * gridSize + 5, CANVASMARGIN + 10);
    ctx2.fillText(alpha(i), CANVASMARGIN + i * gridSize + 5, CANVASHEIGHT - CANVASMARGIN - 5);
  }
  for (let j = 1; j < numRows; j++) {
    ctx2.fillText(alpha(j), CANVASMARGIN + 5, CANVASMARGIN + j * gridSize + 10);
    ctx2.fillText(alpha(j), CANVASWIDTH - CANVASMARGIN - 15, CANVASMARGIN + j * gridSize + 10);
  }
}
async function showCustomAlert(message) {
  swal.fire({
    title: "Train Operations-Alert",
    text: message
  });
}
function pauseBothTrains(train1Number, train2Number) {
  const train1 = game.trains[train1Number - 1];
  const train2 = game.trains[train2Number - 1];
  train1.setUserPaused(true);
  train2.setUserPaused(true);
}
function displayFinancialResults() {
  const cashInHand = game.getCashInHand();
  document.getElementById("cashInHand").textContent = Math.floor(cashInHand / 1e6);
  const financialSummary = game.getCumFinancialSummaryByTrain();
  const tableBody = document.querySelector("#resultsBody");
  financialSummary.totalRevenue.forEach((revenue, index) => {
    if (revenue > 0 || financialSummary.totalExpenses[index] > 0) {
      const expenses = financialSummary.totalExpenses[index];
      const profit = financialSummary.profit[index];
      const revenueCell = tableBody.querySelector(`#revenue-cell-${index + 1}`);
      const expensesCell = tableBody.querySelector(`#expenses-cell-${index + 1}`);
      const profitCell = tableBody.querySelector(`#profit-cell-${index + 1}`);
      if (revenueCell) revenueCell.textContent = Math.floor(revenue / 1e6);
      if (expensesCell) expensesCell.textContent = Math.floor(expenses / 1e6);
      if (profitCell) profitCell.textContent = Math.floor(profit / 1e6);
    }
  });
}
audioManager.setEnabled(true);
//# sourceMappingURL=bundle.js.map
