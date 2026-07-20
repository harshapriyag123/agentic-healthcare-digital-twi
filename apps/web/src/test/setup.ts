import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

beforeEach(() => {
    window.localStorage.clear();
});

HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
HTMLDialogElement.prototype.close = function close() { this.open = false; };
