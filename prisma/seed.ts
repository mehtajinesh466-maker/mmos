import { runSeed } from '../src/lib/seedAction'

async function main() {
  await runSeed()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
