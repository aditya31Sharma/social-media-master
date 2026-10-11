import { normalizeUsername } from './saved-users.js';

export function createProfilePool(users) {
  const byName = new Map(users.map(user => [normalizeUsername(user.username), user]));
  const drawn = new Set();
  let available = new Map(), bag = [], positions = new Map();

  function use(username) {
    const key = normalizeUsername(username);
    if (!available.has(key)) return null;
    drawn.add(key);
    const index = positions.get(key);
    if (index !== undefined) {
      const last = bag.pop();
      if (index < bag.length) { bag[index] = last; positions.set(last, index); }
      positions.delete(key);
    }
    return available.get(key);
  }

  return {
    get remaining() { return bag.length; },
    setSavedUsers(usernames) {
      const saved = usernames && new Set([...usernames].map(normalizeUsername));
      available = new Map(saved ? [...byName].filter(([name]) => !saved.has(name)) : []);
      bag = [...available.keys()].filter(name => !drawn.has(name));
      positions = new Map(bag.map((name, index) => [name, index]));
    },
    use,
    draw() { return bag.length ? use(bag[Math.floor(Math.random() * bag.length)]) : null; },
    find(username, reserved = new Set()) {
      const key = normalizeUsername(username);
      return reserved.has(key) ? null : available.get(key) || null;
    },
    search(query, reserved = new Set(), active = '', limit = 100) {
      const needle = normalizeUsername(query), current = normalizeUsername(active);
      const matches = [];
      let count = 0;
      for (const [name, user] of available) {
        if ((reserved.has(name) && name !== current) || !name.includes(needle)) continue;
        count++;
        if (matches.length < limit) matches.push(user);
      }
      if (current.includes(needle) && available.has(current) && !matches.some(user => normalizeUsername(user.username) === current)) {
        if (matches.length === limit) matches.pop();
        matches.push(available.get(current));
      }
      return { matches, count };
    }
  };
}
