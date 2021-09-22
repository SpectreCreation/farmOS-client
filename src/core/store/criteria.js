import {
  anyPass, complement, evolve, T,
} from 'ramda';
import parseFilter from '../utils/parseFilter';
import farm from '../farm';
import daysAway from '../utils/daysAway';

const assetCriteria = anyPass([
  parseFilter({
    status: 'active',
  }),
  farm.meta.isUnsynced,
]);

const logCriteria = now => anyPass([
  parseFilter({
    timestamp: {
      $gt: daysAway(now, -30),
      $lt: daysAway(now, 15),
    },
  }),
  farm.meta.isUnsynced,
]);

const userCriteria = id => anyPass([
  parseFilter({ id }),
  farm.meta.isUnsynced,
]);

export const cachingCriteria = ({ now = Date.now(), uid = '' } = {}) => ({
  asset: assetCriteria,
  log: logCriteria(now),
  plan: farm.meta.isUnsynced,
  quantity: farm.meta.isUnsynced,
  taxonomy_term: T,
  user: userCriteria(uid),
});

export const evictionCriteria = deps => evolve({
  asset: complement,
  log: complement,
  plan: complement,
  quantity: complement,
  taxonomy_term: complement,
  user: complement,
}, cachingCriteria(deps));
