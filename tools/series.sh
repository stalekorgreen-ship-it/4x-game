#!/bin/bash
# Серия испытаний: каждый сценарий — 30 seed; seed 1–15 составы как заданы, seed 16–30 стороны поменяны местами (A справа).
# Запуск: PORT=5203 tools/series.sh [каталог=/tmp/SER] [длительность=900] [параллельно=4]
cd "$(dirname "$0")/.."; export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}; O=${1:-/tmp/SER}; T=${2:-900}; J=${3:-4}; mkdir -p $O
M="BB,CR,FR,FR,PD,LR"
S=(
"A1_fr_fr|FR|FR|{}"
"A2_fr_cr|FR|CR|{}"
"A3_cr_cr|CR|CR|{}"
"A4_bb_4fr|BB|FR,FR,FR,FR|{}"
"A5_bb_mix|BB|FR,CR,PD|{}"
"B1_equal|$M|$M|{}"
"B2_light_vs_bal|FR,FR,FR,FR,FR,FR,FR,FR|$M|{}"
"B3_heavy_vs_bal|BB,BB,BB,CR|$M|{}"
"B4_scout_repair|$M,SC,RP|$M,FR,FR|{}"
"B5_noroles|$M|$M|{\"planner\":{\"wrole\":0}}"
"C1_nocommand|$M|$M|{\"fleetcmd\":{\"on\":0}}"
"C2_org_vs_not|$M|$M|{\"ab\":{\"side\":0}}"
"C4_flag_damaged|BB*,CR,FR,FR,PD,LR|$M|{}"
"C6_part_damaged|BB*,CR*,FR*,FR,PD,LR|$M|{}"
"D1_art_vs_mis|LR,LR,CR,PD|MG,MG,MS,PD|{}"
"D2_cluster_vs_pd|MC,MC,CR|PD,PD,CR|{}"
"D3_guided_vs_pd|MG,MG,CR|PD,PD,CR|{}"
"D4_mixed_salvo|MG,MS,MC,CR|$M|{}"
)
run(){ IFS='|' read -r n a b p <<< "$1"; pb="$p"; if [[ "$n" == C2_* ]]; then pb='{"ab":{"side":1}}'; fi
  COMP="$a;$b" SEED0=1 node tools/duel-test.cjs 15 "$p" $T comp > $O/$n.A.jsonl 2>&1
  COMP="$b;$a" SEED0=16 node tools/duel-test.cjs 15 "$pb" $T comp > $O/$n.B.jsonl 2>&1; echo "$n done"; }
export -f run; export O T
printf '%s\n' "${S[@]}" | xargs -P $J -I{} bash -c 'run "$@"' _ {}
echo ALL DONE
