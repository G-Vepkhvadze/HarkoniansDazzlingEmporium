'use client'

import { useEffect } from "react";
import LocomotiveScroll from "locomotive-scroll";
import "locomotive-scroll/dist/locomotive-scroll.css";

const LocomotiveScrollProvider = () => {
    useEffect(() => {
        const scroll = new LocomotiveScroll({
            lenisOptions: {
                smoothWheel: true,

                lerp: 0.10,

                duration: 1.5,

                wheelMultiplier: 0.8,
            },
        });

        return () => {
            scroll.destroy();
        };
    }, []);

    return null;
};

export default LocomotiveScrollProvider;