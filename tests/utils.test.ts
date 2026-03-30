import { add } from '../src/utils'

describe('add', () => {
  test('adds two numbers', () => {
    expect(add(1, 2)).toBe(3)
  })
})
