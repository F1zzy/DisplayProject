// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

jest.mock('animejs', () => {
  const noopAnim = {
    pause: jest.fn(),
    cancel: jest.fn(),
    revert: jest.fn(),
    complete: jest.fn(),
    then: (resolve) => Promise.resolve().then(resolve),
    add() {
      return this;
    },
    sync() {
      return this;
    },
    set() {
      return this;
    },
  };

  return {
    animate: jest.fn(() => ({ ...noopAnim })),
    createTimeline: jest.fn(() => ({ ...noopAnim })),
    stagger: jest.fn((value) => value),
  };
});
