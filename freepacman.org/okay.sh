BASE="https://freepacman.org"
DEST="/home/bubba/Downloads/.Apps/Websites/Snake/freepacman.org"

mkdir -p "$DEST/app/style/graphics/spriteSheets/characters/pacman"
mkdir -p "$DEST/app/style/graphics/spriteSheets/characters/ghosts/blinky"
mkdir -p "$DEST/app/style/graphics/spriteSheets/characters/ghosts/clyde"
mkdir -p "$DEST/app/style/graphics/spriteSheets/characters/ghosts/inky"
mkdir -p "$DEST/app/style/graphics/spriteSheets/characters/ghosts/pinky"
mkdir -p "$DEST/app/style/graphics/spriteSheets/characters/ghosts"
mkdir -p "$DEST/app/style/graphics/spriteSheets/pickups"

# Pacman
for f in arrow_down.svg arrow_left.svg arrow_right.svg arrow_up.svg pacman_death.svg pacman_down.svg pacman_left.svg pacman_up.svg; do
  wget -q -P "$DEST/app/style/graphics/spriteSheets/characters/pacman/" "$BASE/app/style/graphics/spriteSheets/characters/pacman/$f"
done

# Blinky
for f in blinky_down_angry.svg blinky_right.svg blinky_right_annoyed.svg blinky_down_annoyed.svg blinky_up_angry.svg blinky_up_annoyed.svg blinky_up.svg blinky_left_annoyed.svg blinky_right_angry.svg blinky_down.svg blinky_left.svg blinky_left_angry.svg; do
  wget -q -P "$DEST/app/style/graphics/spriteSheets/characters/ghosts/blinky/" "$BASE/app/style/graphics/spriteSheets/characters/ghosts/blinky/$f"
done

# Clyde
for f in clyde_right.svg clyde_down.svg clyde_left.svg clyde_up.svg; do
  wget -q -P "$DEST/app/style/graphics/spriteSheets/characters/ghosts/clyde/" "$BASE/app/style/graphics/spriteSheets/characters/ghosts/clyde/$f"
done

# Inky
for f in inky_down.svg inky_right.svg inky_left.svg inky_up.svg; do
  wget -q -P "$DEST/app/style/graphics/spriteSheets/characters/ghosts/inky/" "$BASE/app/style/graphics/spriteSheets/characters/ghosts/inky/$f"
done

# Pinky
for f in pinky_down.svg pinky_up.svg pinky_right.svg pinky_left.svg; do
  wget -q -P "$DEST/app/style/graphics/spriteSheets/characters/ghosts/pinky/" "$BASE/app/style/graphics/spriteSheets/characters/ghosts/pinky/$f"
done

# Ghosts (eyes + scared, no subdirectory)
for f in eyes_down.svg eyes_right.svg eyes_left.svg eyes_up.svg scared_white.svg scared_blue.svg; do
  wget -q -P "$DEST/app/style/graphics/spriteSheets/characters/ghosts/" "$BASE/app/style/graphics/spriteSheets/characters/ghosts/$f"
done

# Pickups
for f in apple.svg powerPellet.svg bell.svg cherry.svg galaxian.svg key.svg orange.svg melon.svg strawberry.svg; do
  wget -q -P "$DEST/app/style/graphics/spriteSheets/pickups/" "$BASE/app/style/graphics/spriteSheets/pickups/$f"
done   
