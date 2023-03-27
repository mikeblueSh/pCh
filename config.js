
module.exports.allowedChannels = [

    {
        from_channel_id: "1346269822",           // از چنلی که میخواهیم کپی کنیم 
        from_access_hash: "6196512673529678929",    //IMTproto
        to_channel_id: "1807124366",               //  به چنل خودمون
        to_access_hash: "14122771068638870228",
    },
    // {
    //     from_channel_id: "1621376664",       //  custom
    //     from_access_hash: "-1749166591188869753",
    //     to_channel_id: "1465897365",
    //     to_access_hash: "-2645923701835533103",
    //     canForward: true
    // },
    // {
    //     from_channel_id: "1883934737",           // از چنلی که میخواهیم کپی کنیم 
    //     from_access_hash: "3023658995117350123",    //from 1
    //     to_channel_id: "1804039139",               //  به چنل خودمون
    //     to_access_hash: "6968775458672498217",        //To1
    // },
    {
        from_channel_id: "1395363861",           // از چنلی که میخواهیم کپی کنیم 
        from_access_hash: "8858470156208116076",   // proxyMTProto
        to_channel_id: "1807124366",               //  به چنل خودمون
        to_access_hash: "14122771068638870228",
    },
    // {
    //     from_channel_id: "1237450487",           // از چنلی که میخواهیم کپی کنیم 
    //     from_access_hash: "5529115721549267077",   // Nproxy
    //     to_channel_id: "1807124366",               //  به چنل خودمون
    //     to_access_hash: "14122771068638870228",
    // },
    {
        from_channel_id: "1203971745",           // از چنلی که میخواهیم کپی کنیم 
        from_access_hash: "12453395901590025866",   // ProxyMTProto_tel
        to_channel_id: "1807124366",               //  به چنل خودمون
        to_access_hash: "14122771068638870228",
    },
    {
        from_channel_id: "1091853463",           // از چنلی که میخواهیم کپی کنیم 
        from_access_hash: "6926654441424796596",   // TelMTProto
        to_channel_id: "1807124366",               //  به چنل خودمون
        to_access_hash: "14122771068638870228",
    },
]
module.exports.fromAllToOneChannel =
{
    to_channel_id: "1807124366",              // اطلاعات چنلی که میخوایم هر نیم ساعت تمام پروکسی های جمع شده از چنل های مختلف بهش ارسال بشه 
    to_access_hash: "14122771068638870228",
}




