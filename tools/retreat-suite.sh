#!/bin/bash
# Отход: 5 сценариев × (отход через планировщик / прежний «прямо от цели») × N seed. Сводка: node tools/retreat-sum.cjs <каталог>
cd "$(dirname "$0")/.."; export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}; O=${1:-/tmp/rt}; N=${2:-6}; T=${3:-1500}; mkdir -p $O
declare -A S=( [r1_single]="BB**;FR,FR" [r2_group]="BB**,FR**,PD**;BB,FR,FR,PD,IC,LR" [r3_fleet]="BB**,BB**,LR**,FR**,PD**,IC**;BB,BB,LR,FR,PD,IC" [r4_faster]="BB**,LR**;IC,IC,IC,IC" [r5_range]="FR**,FR**,BB**;LR,LR,LR" )
for k in "${!S[@]}"; do COMP="${S[$k]}" node tools/duel-test.cjs $N '{}' $T comp > $O/$k.new.txt 2>&1 & COMP="${S[$k]}" node tools/duel-test.cjs $N '{"planner":{"rtr":0}}' $T comp > $O/$k.old.txt 2>&1 & done; wait
