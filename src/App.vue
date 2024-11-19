<script setup lang="ts">
import SparkMD5 from "spark-md5"
import {ref} from 'vue'
const fileHash=ref<string>('')
const fileName=ref<string>('')
const percentage=ref<number>(0)
// const controller = ref<AbortController>()
//验证hash是否存在
const verifying=async ()=>{
   const res = await fetch('http://localhost:3000/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileHash: fileHash.value,
            fileName: fileName.value,
          })
        });
        const data = await res.json();
        return data;
  }
//合并请求
const mergeRequest=()=>{
  fetch('http://localhost:3000/merge',{
    method:'POST',
    headers:{
      'Content-Type':'application/json'
    },
    body:JSON.stringify({
      fileHash:fileHash.value,
      fileName:fileName.value,
      size:CHUNK_SIZE
    })
  }).then((res)=>res.json())
  .then((res)=>{
      alert('合并：上传成功')
    })
}
//上传分片  
const uploadChunks = async (chunks: Blob[],existChunks: string[])=>{
  //重新构建每个分片
  const data=chunks.map((chunk,index)=>{
    return {
      fileHash:fileHash.value,
      chunkHash:fileHash.value+"-"+index,
      fileName:fileName.value,
      chunk
    }
  })
  console.log('data', data)
  console.log('已存在的分片：', existChunks)
  //过滤已上传成功的。
  const formDatas=data
    .filter((item)=>{
      return !existChunks.includes(item.chunkHash)
    })
    .map((item)=>{
      const formData=new FormData()
      formData.append('fileHash',item.fileHash)
      formData.append('chunkHash',item.chunkHash)
      formData.append('chunk',item.chunk)
      formData.append('fileName',item.fileName)
      return formData
  })
  console.log('formDatas:',formDatas)
  const controller = new AbortController();
  const signal = controller.signal;
  //控制并发请求数目
  const max=6//最大请求数
  let index=0
  const taskPool:any=[]//请求池
  while(index<formDatas.length){
    if (taskPool.length === max) {
      // console.log('未完成')
      await Promise.race(taskPool)
      // console.log('taskPool:', taskPool)
      // console.log('下个请求') //有一个成功就继续往下进行
    }else{
      const task = fetch('http://localhost:3000/upload', {
        method: 'POST',
        body: formDatas[index],
        signal 
      })
      task.then(()=>{
        // console.log('当前的数组：',taskPool)
        // console.log('当前item：',task)
        const index = taskPool.findIndex((item: any) => item === task)
        // console.log('已完成：',index)
        taskPool.splice(index,1)
        // console.log('taskPool:',taskPool)
      }).catch((err) => {
        // console.error(`Download error: ${err.message}`);
        controller.abort()
      });
      // console.log('发出请求：', index)
      taskPool.push(task)
      index++
      percentage.value = Math.floor((index / formDatas.length )*100)
    }
  }
  //如果还有请求没执行，
  await Promise.all(taskPool)
  console.log('处理完所有请求')
  //通知服务器合并请求
  mergeRequest()

}
//计算hash
const calculateHash=(chunks:Blob[])=>{
  //封装异步操作，同步执行
  return new Promise(resolve=>{
      const targets:Blob[]=[]//所有参与计算的切片
      chunks.forEach((chunk,index)=>{
        //第一个和最后一个切片的内容全部参与计算
        if(index==0||index==chunks.length-1){
          targets.push(chunk)
        }else{
          //中间剩余的切片我们分别在前面、后面和中间取2个字节参与计算
          targets.push(chunk.slice(0,2))
          targets.push(chunk.slice(CHUNK_SIZE/2,CHUNK_SIZE/2+2))
          targets.push(chunk.slice(CHUNK_SIZE-2,CHUNK_SIZE))
        }
      })
      const spark=new SparkMD5.ArrayBuffer()
      const fileReader=new FileReader()
      fileReader.readAsArrayBuffer(new Blob(targets))
      //onload异步执行，只有读取完毕才执行，要同步获取hash
      fileReader.onload=(e)=>{
        spark.append((e.target as FileReader).result)
        let hash = spark.end()
        console.log('hash:'+hash)
        resolve(hash)
      }
  })
  
}
//每个分片的大小
const CHUNK_SIZE=1024*10 //1MB
const createChunks=(file:File)=>{
  //1MB=1024KB=1024*1024B(字节)
  let cur=0
  let chunks=[]
  while(cur<file.size){
    const blob=file.slice(cur,cur+CHUNK_SIZE)
    chunks.push(blob)
    cur+=CHUNK_SIZE
  }
  return chunks
}


const handleUpload=async (e:Event)=>{
  console.log((e.target as HTMLInputElement).files)//伪数组，没有map方法
  const files=(e.target as HTMLInputElement).files
  if(!files)return 
  //读取文件
  console.log(files[0])
  fileName.value=files[0].name
  //文件分片
  const chunks=createChunks(files[0])
  console.log("chunks:",chunks)
  //hash计算 只有一个hash值
  const hash=await calculateHash(chunks)//两次不一样
  console.log(hash)
  //上传分片
  fileHash.value=hash as string

  //校验hash是否存在
  const data=await verifying()
  console.log(data)
  if(!data.data.shouldUpload){
    alert('妙传：上传成功')
    return
  }
  //合并请求
  uploadChunks(chunks,data.data.existChunks)
}


// var time1=requestAnimationFrame(function(){
//   console.log(time1)
// })
// var time2 = requestAnimationFrame(function () {
//   console.log(time2)
// })
// var time3 = requestAnimationFrame(function () {
//   console.log(time3)
// })
// cancelAnimationFrame(time1)
// cancelAnimationFrame(2)
// //兼容性
// if(!window.requestAnimationFrame){
//   let requestAnimationFrame=function(fn:Function){
//     setTimeout(fn,17)
//   }
// }
window.onload=function(){
  //进度条
  let test = document.getElementById('test')
  //写法一
  test!.onclick = function () {
    let timer= setInterval(() => {
      if (parseInt(test!.style.width)<300){
        test!.style.width= parseInt(test!.style.width) +5+'px'
        test!.innerHTML = test!.style.width+"%"
      }else{
        clearInterval(timer)
      }
    },17)
  }
  // //写法二
  // test!.onclick = function () {
  //   let timer = setTimeout(function fn() {
  //     if (parseInt(test!.style.width) < 300) {
  //       test!.style.width = parseInt(test!.style.width) + 5 + 'px'
  //       test!.innerHTML = Math.floor(parseInt(test!.style.width)/3) + "%"
  //       timer=setTimeout(fn,17)
  //     } else {
  //       clearTimeout(timer)
  //     }
  //   }, 17)
  // }
  // //写法三
  // test!.onclick = function () {
  //   let timer = requestAnimationFrame(function fn() {
  //     if (parseInt(test!.style.width) < 300) {
  //       test!.style.width = parseInt(test!.style.width) + 5 + 'px'
  //       test!.innerHTML = Math.floor(parseInt(test!.style.width) / 3) + "%"
  //       timer=requestAnimationFrame(fn)
  //     } else {
  //       cancelAnimationFrame(timer)
  //     }
  //   })
  // }


}



</script>
<template>
  <div id="test" style="width: 0px;height: 12px;line-height: 12px;background-color: red;">
    {{ percentage }}%
  </div>
  <input type="range" name="" id="" min="0" max="100" :value="percentage">
  <div>
    <h1>大文件上传</h1>
    <input type="file" @change="handleUpload">
  </div>
</template>

<style scoped>

</style>
