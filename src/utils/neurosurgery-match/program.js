import axios from "axios"


export const getProgramInfo = async () => {
    const res = await fetch('../assets/nsgymatch_bd_20230512_183017.csv')
    return res.text();
}