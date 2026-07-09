const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ตัวแปรเก็บข้อมูล ROM (เก็บ Machine Code ที่แปลงแล้ว)
let romData = [];

// ==========================================
// 1. ตารางคำสั่ง (Instruction Set Architecture - ISA)
// **ส่วนนี้สำคัญมาก คุณต้องเปลี่ยนเลขให้ตรงกับวงจร CPU ในเกมของคุณ!**
// สมมติว่า CPU ของคุณใช้ 4 บิตแรกเป็นคำสั่ง (Opcode) และ 4 บิตหลังเป็นตัวเลข (Operand)
// ==========================================
const opcodes = {
    'NOP': 0,    // 0000 0000 (ไม่ทำอะไร)
    'LDA': 16,   // 0001 0000 (โหลดค่าใส่ Register A)
    'ADD': 32,   // 0010 0000 (บวกค่า)
    'SUB': 48,   // 0011 0000 (ลบค่า)
    'OUT': 64,   // 0100 0000 (ส่งค่าออกหน้าจอ)
    'HLT': 240   // 1111 0000 (หยุดทำงาน)
};

// ==========================================
// 2. ระบบแปลภาษา Assembly -> Machine Code
// ==========================================
app.post('/api/compile', (req, res) => {
    const sourceCode = req.body.code;
    const lines = sourceCode.split('\n');
    let machineCode = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim().toUpperCase();
        
        // ข้ามบรรทัดว่างหรือคอมเมนต์
        if (!line || line.startsWith('//')) continue; 

        // แยกคำสั่ง กับ ตัวเลข เช่น "LDA 5" -> ["LDA", "5"]
        const parts = line.split(' ');
        const instruction = parts[0];
        const operand = parts.length > 1 ? parseInt(parts[1]) : 0;

        if (opcodes[instruction] !== undefined) {
            // เอา Opcode มารวมกับ Operand
            // เช่น LDA (16) + 5 = 21 (ฐานสองคือ 0001 0101)
            const finalByte = opcodes[instruction] + (operand & 15); // กันไม่ให้ตัวเลขเกิน 4 บิต
            machineCode.push(finalByte);
        } else {
            return res.status(400).json({ error: `ไม่รู้จักคำสั่ง: ${instruction} ที่บรรทัด ${i+1}` });
        }
    }
    
    // อัปเดตข้อมูลในระบบเตรียมส่งให้เกม
    romData = machineCode;
    res.json({ success: true, machineCode: romData });
});

// ==========================================
// 3. ช่องทางให้ Roblox มาดึงข้อมูล (HTTP GET)
// ==========================================
app.get('/api/rom', (req, res) => {
    // ส่งข้อมูลเป็นตัวเลขคั่นด้วยลูกน้ำ เช่น "21,35,64,240"
    // เพื่อให้ใน Roblox เอาไปแยกคำ (split) ได้ง่ายๆ
    res.send(romData.join(','));
});

// ==========================================
// 4. หน้าเว็บ UI สำหรับเขียนโค้ดสไตล์ Hacker/OS
// ==========================================
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Roblox OS Code Editor</title>
        <style>
            body { background-color: #050505; color: #00ff00; font-family: 'Courier New', Courier, monospace; display: flex; flex-direction: column; align-items: center; padding: 20px; margin: 0; }
            .container { width: 100%; max-width: 800px; }
            h1 { text-align: center; border-bottom: 2px solid #00ff00; padding-bottom: 10px; text-transform: uppercase; letter-spacing: 2px; }
            .editor-area { display: flex; gap: 20px; margin-top: 20px; }
            .box { flex: 1; display: flex; flex-direction: column; }
            label { margin-bottom: 5px; font-weight: bold; }
            textarea { background-color: #111; color: #00ff00; border: 1px solid #333; padding: 15px; height: 300px; font-family: 'Courier New', Courier, monospace; font-size: 16px; resize: none; outline: none; }
            textarea:focus { border-color: #00ff00; box-shadow: 0 0 10px rgba(0, 255, 0, 0.2); }
            button { background-color: #00ff00; color: #000; border: none; padding: 15px; font-size: 18px; font-weight: bold; cursor: pointer; margin-top: 20px; transition: 0.2s; text-transform: uppercase; }
            button:hover { background-color: #00cc00; transform: scale(1.02); }
            .binary-output { background-color: #111; color: #fff; padding: 15px; border: 1px solid #333; height: 300px; overflow-y: auto; font-size: 14px; white-space: pre-wrap; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>CPU Logic Code Editor</h1>
            <p style="text-align:center">พิมพ์โค้ด Assembly ด้านซ้ายเพื่อแปลงเป็น 8-Bit Machine Code ส่งเข้าเกม</p>
            
            <div class="editor-area">
                <div class="box">
                    <label>Source Code (Assembly)</label>
                    <textarea id="sourceCode" spellcheck="false">
// พิมพ์โค้ดที่นี่
LDA 5
ADD 3
OUT
HLT
                    </textarea>
                </div>
                
                <div class="box">
                    <label>Machine Code (8-Bit Binary)</label>
                    <div class="binary-output" id="outputArea">// โค้ดฐานสองจะแสดงที่นี่</div>
                </div>
            </div>

            <button onclick="compileCode()">Compile & Upload to Server</button>
            <div id="status" style="margin-top:15px; text-align:center;"></div>
        </div>

        <script>
            function compileCode() {
                const code = document.getElementById('sourceCode').value;
                document.getElementById('status').innerText = "กำลังคอมไพล์...";
                document.getElementById('status').style.color = "yellow";

                fetch('/api/compile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: code })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        document.getElementById('status').innerText = "❌ Error: " + data.error;
                        document.getElementById('status').style.color = "red";
                    } else {
                        document.getElementById('status').innerText = "✅ คอมไพล์สำเร็จ! พร้อมให้ Roblox มาดึงข้อมูล";
                        document.getElementById('status').style.color = "#00ff00";
                        
                        // แสดงผลเป็นเลขฐานสอง
                        let binText = "";
                        data.machineCode.forEach(num => {
                            binText += num.toString(2).padStart(8, '0') + "  (Decimal: " + num + ")\\n";
                        });
                        document.getElementById('outputArea').innerText = binText;
                    }
                });
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Web IDE ทำงานแล้ว! เปิดพอร์ต ${PORT}`);
});
