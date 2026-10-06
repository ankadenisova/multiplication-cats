-- 0013 re-activated all missing-factor cards; 2×2 stays retired in both kinds.
UPDATE cards SET active = false WHERE a = 2 AND b = 2;
