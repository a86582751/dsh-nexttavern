// Generated from runtime/alpha3/compat/ui-workspace/src/client/rows/AnimatedRows.tsx; edit the TypeScript source.
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/** React-commit-driven movement and entry/exit fades for the sidebar's keyed rows. */
import { Component, createRef } from 'react';
import css from './AnimatedRows.module.css';
const ROW_FADE_MS = 100;
const ROW_GLIDE_MS = 200;
function sameRows(previous, next) {
    return previous.rowKeys.length === next.rowKeys.length
        && previous.rowKeys.every((key, index) => key === next.rowKeys[index]);
}
function intersects(row, viewport) {
    return row.bottom > viewport.top && row.top < viewport.bottom
        && row.right > viewport.left && row.left < viewport.right;
}
/**
 * Animates keyed sidebar rows only when their rendered membership or order changes.
 * Motion starts after the first pointer or keyboard input inside the mounted list.
 * The parent supplies a positioned container for the inert exit overlay.
 */
export class AnimatedRows extends Component {
    armed = false;
    list = createRef();
    overlay = createRef();
    movements = new Map();
    exits = new Map();
    getSnapshotBeforeUpdate(previous) {
        const list = this.list.current;
        if (!this.armed || sameRows(previous, this.props) || previous.resetKey !== this.props.resetKey
            || !previous.ready || !this.props.ready || list === null
            || typeof list.animate !== 'function'
            || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
            return null;
        const viewport = list.getBoundingClientRect();
        const positions = this.readPositions();
        const nextKeys = new Set(this.props.rowKeys);
        const removed = new Map();
        for (const [key, row] of positions) {
            if (nextKeys.has(key) || !intersects(row.rect, viewport))
                continue;
            const clone = row.element.cloneNode(true);
            clone.removeAttribute('data-row-key');
            clone.inert = true;
            clone.style.setProperty('--dsh-workspace-indent', getComputedStyle(row.element).getPropertyValue('--dsh-workspace-indent'));
            removed.set(key, { ...row, element: clone });
        }
        return { positions, removed };
    }
    componentDidUpdate(previous, _state, snapshot) {
        if (snapshot === null) {
            if (!sameRows(previous, this.props) || previous.resetKey !== this.props.resetKey
                || previous.ready !== this.props.ready)
                this.clear();
            return;
        }
        this.cancelMovements();
        const list = this.list.current;
        const overlay = this.overlay.current;
        const viewport = list.getBoundingClientRect();
        const origin = overlay.getBoundingClientRect();
        const positions = this.readPositions();
        for (const [key, row] of positions) {
            this.removeExit(key);
            const previousRow = snapshot.positions.get(key);
            if (!intersects(row.rect, viewport)
                && (previousRow === undefined || !intersects(previousRow.rect, viewport)))
                continue;
            if (previousRow === undefined) {
                this.move(row.element, [{ opacity: 0 }, { opacity: 1 }], ROW_FADE_MS);
                continue;
            }
            const dx = previousRow.rect.left - row.rect.left;
            const dy = previousRow.rect.top - row.rect.top;
            if (dx === 0 && dy === 0 && previousRow.opacity === 1)
                continue;
            this.move(row.element, [
                { transform: `translate(${String(dx)}px, ${String(dy)}px)`, opacity: previousRow.opacity },
                { transform: 'translate(0, 0)', opacity: 1 },
            ], ROW_GLIDE_MS);
        }
        for (const [key, row] of snapshot.removed) {
            const { element } = row;
            this.removeExit(key);
            Object.assign(element.style, {
                position: 'absolute', margin: '0', transform: 'none', boxSizing: 'border-box',
                left: `${String(row.rect.left - origin.left)}px`,
                top: `${String(row.rect.top - origin.top)}px`,
                width: `${String(row.rect.width)}px`, height: `${String(row.rect.height)}px`,
            });
            overlay.append(element);
            const animation = element.animate([{ opacity: row.opacity }, { opacity: 0 }], {
                duration: ROW_FADE_MS, easing: 'ease-out', fill: 'forwards',
            });
            this.exits.set(key, { element, animation });
            animation.onfinish = () => { this.removeExit(key); };
        }
    }
    componentWillUnmount() {
        this.clear();
    }
    readPositions() {
        const list = this.list.current;
        const rows = list.querySelectorAll('[data-row-key]');
        return new Map(Array.from(rows, element => [element.dataset.rowKey, {
                element,
                rect: element.getBoundingClientRect(),
                opacity: this.movements.has(element) ? Number(getComputedStyle(element).opacity) : 1,
            }]));
    }
    move(element, keyframes, duration) {
        const animation = element.animate(keyframes, { duration, easing: 'ease-out' });
        this.movements.set(element, animation);
        animation.onfinish = () => { this.movements.delete(element); animation.cancel(); };
    }
    cancelMovements() {
        for (const animation of this.movements.values()) {
            animation.onfinish = null;
            animation.cancel();
        }
        this.movements.clear();
    }
    removeExit(key) {
        const exit = this.exits.get(key);
        if (exit === undefined)
            return;
        exit.animation.onfinish = null;
        exit.animation.cancel();
        exit.element.remove();
        this.exits.delete(key);
    }
    clear() {
        this.cancelMovements();
        for (const key of this.exits.keys())
            this.removeExit(key);
    }
    render() {
        return _jsxs(_Fragment, { children: [_jsx("div", { ref: this.list, className: this.props.className, role: "tree", "aria-label": this.props.label, onPointerDownCapture: () => { this.armed = true; }, onKeyDownCapture: () => { this.armed = true; }, children: this.props.children }), _jsx("div", { ref: this.overlay, className: css.exits, "aria-hidden": "true" })] });
    }
}
