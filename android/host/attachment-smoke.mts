/** Execute inside the packaged Android Host, using the real attachment API. */
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, rm} from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {saveImageFile, readImageFile, prepareImageFile} from '@deepseek-ai/dsh-attachment-local'

const temporary = process.env.TMPDIR
if (!temporary) throw new Error('Use the native app-owned TMPDIR')
await mkdir(temporary,{recursive:true})
const root = await mkdtemp(path.join(temporary,'attachment-qualification-'))
const started = performance.now()
const limits = {maxImageBytes:1_000_000,maxImagePixels:1_000_000,maxImageDimension:1024}
const policy = {maxBytes:100_000,maxPixels:16,maxDimension:4}
try {
  const rgb = sharp({create:{width:8,height:4,channels:3,background:{r:220,g:70,b:30}}})
  const rgba = sharp({create:{width:8,height:4,channels:4,background:{r:20,g:80,b:200,alpha:0.5}}})
  const fixtures = [
    {name:'oriented.jpg',mediaType:'image/jpeg',data:await rgb.clone().withMetadata({orientation:6}).jpeg().toBuffer(),width:2,height:4,alpha:false},
    {name:'alpha.png',mediaType:'image/png',data:await rgba.clone().png().toBuffer(),width:4,height:2,alpha:true},
    {name:'alpha.webp',mediaType:'image/webp',data:await rgba.clone().webp().toBuffer(),width:4,height:2,alpha:true},
    {name:'frame.gif',mediaType:'image/gif',data:await rgb.clone().gif().toBuffer(),width:4,height:2,alpha:undefined},
  ]
  for(const fixture of fixtures) {
    const ref = await saveImageFile(root,fixture,limits,policy)
    assert.equal(ref.width,fixture.width)
    assert.equal(ref.height,fixture.height)
    const restored = await readImageFile(root,ref)
    const metadata = await sharp(restored.data).metadata()
    assert.equal(metadata.orientation,undefined)
    assert.equal(metadata.exif,undefined)
    if(fixture.alpha !== undefined) assert.equal(metadata.hasAlpha,fixture.alpha)
    assert.equal(restored.ref.attachmentId,ref.attachmentId)
  }
  await assert.rejects(prepareImageFile({data:Buffer.from('not an image'),mediaType:'image/png'},limits,policy))
  console.log(JSON.stringify({schemaVersion:1,kind:'attachment-smoke',platform:process.platform,arch:process.arch,
    result:'passed',cases:['jpeg-orientation','png-alpha','webp-alpha','gif','malformed','durable-read'],
    milliseconds:Math.round(performance.now()-started),versions:sharp.versions}))
} finally {await rm(root,{recursive:true,force:true})}
