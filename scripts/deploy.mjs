// Veröffentlicht dist/ auf dem Branch gh-pages (GitHub Pages: Source = gh-pages / root).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const run = (cmd, cwd = 'dist') => execSync(cmd, { cwd, stdio: 'inherit' })
const remote = execSync('git remote get-url origin').toString().trim()
const rev = execSync('git rev-parse --short HEAD').toString().trim()

writeFileSync('dist/.nojekyll', '')
writeFileSync('dist/404.html', '<!doctype html><meta http-equiv="refresh" content="0;url=/Fitnessapp/">')
run('git init -q -b gh-pages')
run('git add -A')
run(`git -c user.name=deploy -c user.email=deploy@localhost commit -q -m "Deploy ${rev}"`)
run(`git push -q -f ${remote} gh-pages`)
console.log(`Deployed ${rev} to gh-pages`)
