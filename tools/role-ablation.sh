#!/bin/bash
# Польза ролей: смешанный 8×8, все режимы на одних seed: роли целиком / без ролей / без одной роли (её влияние на манёвр выключено, назначение остаётся)
cd "$(dirname "$0")/.."; export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}; O=${1:-/tmp/abl}; N=${2:-6}; T=${3:-1500}; mkdir -p $O
M="BB,BB,LR,PD,PD,IC,IC,MS"; C=${COMP:-"$M;$M"}
declare -A P=( [all]='{}' [none]='{"planner":{"wrole":0}}' [noLine]='{"planner":{"roff":["линия"]}}' [noPVO]='{"planner":{"roff":["ПВО"]}}' [noIC]='{"planner":{"roff":["перехват"]}}' [noSup]='{"planner":{"roff":["поддержка"]}}' )
for m in "${!P[@]}"; do COMP="$C" node tools/duel-test.cjs $N "${P[$m]}" $T comp > $O/$m.txt 2>&1 & done; wait
