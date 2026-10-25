-- Ramène les niveaux historiques sur la nouvelle échelle de 1 à 4.
UPDATE users SET level = 4 WHERE level > 4;
