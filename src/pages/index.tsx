import { useEffect, useReducer, useState } from 'react';
import style from '../styles/Home.module.css';

const enum Action {
    UNDO,
    REDO,
    CLICK,
    RESET,
}

const enum Field {
    EMPTY,
    PLAYER_A,
    PLAYER_B,
}

type Position = {
    readonly x: number;
    readonly y: number;
}

type Vec = readonly [number, number];
type History = number[];
type Grid = Field[][];
type HighlightGrid = boolean[][];

type GameState = {
    grid: Grid;
    highlight: HighlightGrid;
    currentPlayer: Field.PLAYER_A | Field.PLAYER_B;
    history: History;
    historyIndex: number;
};

type GameAction =
    | { type: Action.UNDO }
    | { type: Action.REDO }
    | { type: Action.CLICK; colIndex: number, isReplay?: boolean }
    | { type: Action.RESET };

const NUM_ROWS = 6;
const NUM_COLS = 7;

const allPositions = new Array(NUM_ROWS * NUM_COLS).fill(null).map((_, i) => ({ x: i % NUM_COLS, y: Math.floor(i / NUM_COLS) }));

const vecs = [
    [-1, 0],
    [0, -1],
    [-1, -1],
    [-1, 1],
] as const satisfies readonly Vec[];

const create2DArray = <T extends unknown>(rows: number, cols: number, fill: T): T[][] => Array(rows).fill(null).map(() => Array(cols).fill(fill));
const switchPlayers = (player: Field) => player === Field.PLAYER_A ? Field.PLAYER_B : Field.PLAYER_A;
const addVecToPosition = (a: Position, b: Vec): Position => ({ x: a.x + b[0], y: a.y + b[1] });
const isInsideGrid = (grid: readonly unknown[][], { x, y }: Position) => y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;

const checkForWin = (grid: Grid, lastPlacedPosition: Position) => {
    const WinningCellsMultipleAngles = [];

    for (let vec of vecs) {
        let count = 1; // count includes the last placed cell.
        let winningCells = [lastPlacedPosition];

        for (const direction of [1, -1]) {
            const step = vec.map(x => x * direction) as [number, number];
            let currentPosition = addVecToPosition(lastPlacedPosition, step);

            while (isInsideGrid(grid, currentPosition) && grid[currentPosition.y][currentPosition.x] === grid[lastPlacedPosition.y][lastPlacedPosition.x]) {
                count++;
                winningCells.push(currentPosition);
                currentPosition = addVecToPosition(currentPosition, step);
            }
        }

        if (count >= 4) {
            WinningCellsMultipleAngles.push(...winningCells);
        }
    }

    return WinningCellsMultipleAngles;
};

const setStateURL = (history: History) => {
    window.history.replaceState(null, "", window.location.origin + "?" + new URLSearchParams({ h: history.join("") }));
};

const historyFromStateURL = () => {
    const params = new URLSearchParams(window.location.search);
    const history = params.get("h");

    if (history) return history.split("").map(Number);
    return [];
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


const bottomEmptyRow = (grid: Grid, colIndex: number) => {
    for (let y = 0; y < grid.length; y++) {
        if (grid[y][colIndex] !== Field.EMPTY) return y - 1;
    }

    return grid.length - 1;
}

const setTopFilledRow = (grid: Grid, colIndex: number, value: Field = Field.EMPTY) => {
    const y = bottomEmptyRow(grid, colIndex) + 1;
    grid[y][colIndex] = value;
}

const setBottomEmptyRow = (grid: Grid, colIndex: number, value: Field) => {
    const y = bottomEmptyRow(grid, colIndex);
    grid[y][colIndex] = value;
}

const getHighlightedPositions = (grid: Grid, position: Position) => {
    if (grid[position.y][position.x] === Field.EMPTY) return [];

    const win = checkForWin(grid, position);
    return win;
};

const applyHighlightedPositions = (positions: Position[], baseHighlightGrid?: HighlightGrid) => {
    const highlightGrid = baseHighlightGrid ?? create2DArray(NUM_ROWS, NUM_COLS, false);

    positions.forEach(({ x, y }) => highlightGrid[y][x] = true);

    return highlightGrid;
};

const getHighlightGridBase = (grid: Grid, around: Position, baseHighlightGrid?: HighlightGrid) => applyHighlightedPositions(getHighlightedPositions(grid, around), baseHighlightGrid);
const getHighlightGrid = (grid: Grid, baseHighlightGrid?: HighlightGrid) => applyHighlightedPositions(allPositions.flatMap(pos => getHighlightedPositions(grid, pos)), baseHighlightGrid);

const isOver = (highlightGrid: HighlightGrid) => highlightGrid.some(row => row.some(Boolean));

const gameReducer = (state: GameState, action: GameAction): GameState => {
    switch (action.type) {

        case Action.UNDO: {
            if (state.historyIndex === 0) return state;

            const tempGrid = structuredClone(state.grid);
            setTopFilledRow(tempGrid, state.history.at(state.historyIndex - 1)!, Field.EMPTY);

            const tempHighlight = getHighlightGrid(tempGrid);

            return {
                ...state,
                grid: tempGrid,
                highlight: tempHighlight,
                currentPlayer: switchPlayers(state.currentPlayer),
                historyIndex: state.historyIndex - 1,
            };
        }

        case Action.REDO: {
            if (state.historyIndex >= state.history.length) return state;

            const tempGrid = structuredClone(state.grid);
            setBottomEmptyRow(tempGrid, state.history.at(state.historyIndex)!, state.currentPlayer);

            const tempHighlight = getHighlightGrid(tempGrid);

            return {
                ...state,
                grid: tempGrid,
                highlight: tempHighlight,
                currentPlayer: switchPlayers(state.currentPlayer),
                historyIndex: state.historyIndex + 1,
            };
        }

        case Action.CLICK: {
            if (isOver(state.highlight)) return state;

            const y = bottomEmptyRow(state.grid, action.colIndex);
            if (y < 0) return state;

            const tempGrid = structuredClone(state.grid);
            tempGrid[y][action.colIndex] = state.currentPlayer;

            const tempHighlight = getHighlightGridBase(tempGrid, { x: action.colIndex, y }, structuredClone(state.highlight))

            const newHistory = [...state.history.slice(0, state.historyIndex), action.colIndex];
            if (!action.isReplay) setStateURL(newHistory);

            return {
                ...state,
                grid: tempGrid,
                highlight: tempHighlight,
                history: newHistory,
                historyIndex: newHistory.length,
                currentPlayer: switchPlayers(state.currentPlayer),
            };
        }

        case Action.RESET: {
            setStateURL([]);

            return {
                ...state,
                grid: create2DArray(NUM_ROWS, NUM_COLS, Field.EMPTY),
                highlight: create2DArray(NUM_ROWS, NUM_COLS, false),
                currentPlayer: Field.PLAYER_A,
                history: [],
                historyIndex: 0,
            };
        }
        default:
            throw new Error("Invalid action");
    }
};

const useConnectFour = () => {
    const [state, dispatch] = useReducer(gameReducer, {
        grid: create2DArray(NUM_ROWS, NUM_COLS, Field.EMPTY),
        highlight: create2DArray(NUM_ROWS, NUM_COLS, false),
        currentPlayer: Field.PLAYER_A,
        history: [],
        historyIndex: 0,
    });
    const [isLocked, setIsLocked] = useState(true);

    useEffect(() => {
        const history = historyFromStateURL();
        let cleanedUp = false;

        (async () => {
            for (const colIndex of history) {
                await sleep(100);
                if (cleanedUp) return;

                dispatch({
                    type: Action.CLICK,
                    colIndex,
                    isReplay: true,
                });
            }

            setIsLocked(false);
        })();

        return () => {
            cleanedUp = true;
        }
    }, []);

    const handleClick = (colIndex: number) => dispatch({ type: Action.CLICK, colIndex });
    const undo = () => dispatch({ type: Action.UNDO });
    const redo = () => dispatch({ type: Action.REDO });
    const reset = () => dispatch({ type: Action.RESET });

    return {
        grid: state.grid,
        highlight: state.highlight,
        currentPlayer: state.currentPlayer,
        history: state.history,
        historyIndex: state.historyIndex,
        isLocked,
        handleClick,
        undo,
        redo,
        reset,
    };
};

const ConnectFour = () => {
    const {
        grid,
        highlight,
        currentPlayer,
        history,
        historyIndex,
        isLocked,
        handleClick,
        undo,
        redo,
        reset,
    } = useConnectFour();

    const _isOver = isOver(highlight);

    return (
        <main className={style.main} data-current-player={currentPlayer} data-is-finished={_isOver}>
            <h1 className={style.title}>Connect 4</h1>
            <div className={style.grid} style={{
                "--num-rows": NUM_ROWS,
                "--num-cols": NUM_COLS,
            } as React.CSSProperties}>
                {grid[0].map((_, colIndex) => (
                    <button
                        key={colIndex}
                        className={style.col}
                        onClick={() => handleClick(colIndex)}
                        disabled={isLocked || _isOver}
                    >
                        {grid.map((_, rowIndex) => (
                            <div
                                key={`${colIndex}:${rowIndex}`}
                                data-player={grid[rowIndex][colIndex]}
                                data-is-highlighted={highlight[rowIndex][colIndex]}
                                className={style.cell}
                            ></div>
                        ))}
                    </button>
                ))}
            </div>
            <div className={style.menu}>
                <button className={style.menuButton} onClick={undo} disabled={isLocked || historyIndex === 0}>undo</button>
                <button className={style.menuButton} onClick={redo} disabled={isLocked || (historyIndex === history.length)}>redo</button>
                <button className={style.menuButton} onClick={reset} disabled={isLocked || history.length === 0}>reset</button>
            </div>
        </main>
    );
};

export default ConnectFour;
