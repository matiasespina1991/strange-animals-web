animation typography
3D Layered Text: Motion and Variations

Amit Sheen on Aug 20, 2025
In the previous chapter, we built a basic 3D layered text effect using nothing but HTML and CSS. It looks great and has a solid visual presence, but it’s completely static. That is about to change.

In this chapter, we will explore ways to animate the effect, add transitions, and play with different variations. We will look at how motion can enhance depth, and how subtle tweaks can create a whole new vibe.

3D Layered Text Article Series
The Basics
Motion and Variations (you are here!)
Interactivity and Dynamicism
⚠️ Motion Warning: This article contains multiple animated examples that may include flashing or fast moving visuals. If you are sensitive to motion, please proceed with caution.

‘Counter’ Animation
Let’s start things off with a quick animation tip that pairs perfectly with layered 3D text. Sometimes, we want to rotate the element without actually changing the orientation of the text so it stays readable. The trick here is to combine multiple rotations across two axes. First, rotate the text on the z-axis. Then, add a tilt on the x-axis. Finally, rotate the text back on the z-axis.

@keyframes wobble {
from { transform: rotate(0deg) rotateX(20deg) rotate(360deg); }
to { transform: rotate(360deg) rotateX(20deg) rotate(0deg); }
}
Since we rotate on the z-axis and then reverse that rotation, the text keeps its original orientation. But because we add a tilt on the x-axis in the middle, and the x-axis itself keeps rotating, the angle of the tilt changes as well. This creates a kind of wobble effect that shows off the text from every angle and emphasizes the sense of depth.

If we want to take this a few steps further, we can combine the wobble with a floating effect. We will animate the .layers slightly along the z-axis:

.layers {
animation: hover 2s infinite ease-in-out alternate;
}

@keyframes hover {
from { transform: translateZ(0.3em); }
to { transform: translateZ(0.6em); }
}
To really sell the effect, we will leave the original span in place — like a shadowed anchor — change its color to transparent, and animate the blur factor of its text-shadow:

span {
color: transparent;
animation: shadow 2s infinite ease-in-out alternate;
}

@keyframes shadow {
from { text-shadow: 0 0 0.1em #000; }
to { text-shadow: 0 0 0.2em #000; }
}
Syncing those two animations together gives the whole thing a more realistic feel:

Splitting Letters
OK, this is starting to look a lot better now that things are moving. But the whole word is still moving as one. Can we make each letter move independently? The answer, as usual, is “yes, but…”

It is absolutely possible to split each word into a separate letters and animate them individually. But it also means a lot more elements moving on the screen, and that can lead to performance issues. If you go this route, try not to animate too many letters at once, and consider reducing the number of layers.

In the next example, for instance, I reduced the layer count to sixteen. There are five letters, and to place them side by side, I gave the .scene a display: flex, then added a small delay to each letter using :nth-child:

New Angles
Until now, we have only been moving the text along the z-axis, but we can definitely take it further. Each layer can be moved or rotated in any direction you like, and if we base those transformations on the --n variable, we can create all sorts of interesting effects. Here are a few I played with, just to give you some ideas.

In the first one, I am animating the translateX to create a shifting effect:

In the others, I am adding a bit of rotation. The first one is applied to the y-axis for the sloping effect:

This next example applies rotation on the x-axis for the tilting:

And, finally, we can apply it on the z-axis for a rotating example:

Layer Delay
Working with separate layers does not just let us tweak the animation for each one; it also lets us adjust the animation-delay for every layer individually, which can lead to some really interesting effects. Let us take this pulsing example:

Right now, the animation is applied to the .layeredText element itself, and I am simply changing its scale:

.layeredText {
animation: pulsing 2s infinite ease-out;
}

@keyframes pulsing {
0%, 100% { scale: 1; }
20% { scale: 1.2; }
}
But we can apply the animation to each layer separately and give each one a slight delay. Note that the span is part of the stack. It is a layer, too, and sometimes you will want to include it in the animation:

.layer {
--delay: calc(var(--n) \* 0.3s);
}

:is(span, .layer) {
animation: pulsing 2s var(--delay, 0s) infinite ease-out;
}
Here I am using the :is selector to target both the individual layers and the span itself with the same animation. The result is a much more lively and engaging effect:

Pseudo Decorations
In the previous chapter, I mentioned that I usually prefer to save pseudo elements for decorative purposes. This is definitely a technique worth using. We can give each layer one or two pseudo elements, add some content, position them however we like, and the 3D effect will already be there.

It can be anything from simple outlines to more playful shapes. Like arrows, for example:

Notice that I am using the :is selector to include the span here, too, but sometimes we will not want to target all the layers — only a specific portion of them. In that case, we can use :nth-child to select just part of the stack. For example, if I want to target only the bottom twelve layers (out of twenty four total), the decoration only covers half the height of the text. I can do something like :nth-child(-n + 12) , and the full selector would be:

:is(span, .layer:nth-child(-n + 12))::before {
/_ pseudo style _/
}
This is especially useful when the decoration overlaps with the text, and you do not want to cover it or make it hard to read.

Of course, you can animate these pseudo elements too. So how about a 3D “Loading” text with a built-in spinner?

I made a few changes to pull this off. First, I selected twelve layers from the middle of the stack using a slightly more advanced selector: .layer:nth-child(n + 6):nth-child(-n + 18). This targets the layers from number six to eighteen.

Second, to fake the shadow, I added a blur filter to the span‘s pseudo element. This creates a nice soft effect, but it can cause performance issues in some cases, so use it with care.

:is(span, .layer:nth-child(n + 6):nth-child(-n + 18))::before {
/_ spinner style _/
}

span {
/_ span style _/

&::before {
filter: blur(0.1em);
}
}
Face Painting
But you don’t have to use pseudo elements to add some visual interest. You can also style any text with a custom pattern using background-image. Just select the top layer with the :last-child selector, set its text color to transparent so the background shows through, and use background-clip: text.

.layer {
/_ layer style _/

&:last-child {
color: transparent;
background-clip: text;
background-image: ... /_ use your imagination _/
}
}
Here is a small demo using striped lines with repeating-linear-gradient, and rings made with repeating-radial-gradient:

And, yes, you can absolutely use an image too:

Animating Patterns
Let us take the previous idea a couple of steps further. Instead of applying a pattern just to the top layer, we will apply it to all the layers, creating a full 3D pattern effect. Then we will animate it.

We’ll start with the colors. First, we give all the layers a transparent text color. The color we used before will now be stored in a custom property called --color, which we will use in just a moment.

.layer {
--n: calc(var(--i) / var(--layers-count));
--color: hsl(200 30% calc(var(--n) \* 100%));

color: transparent;
}
Now let’s define the background, and we’ll say we want a moving checkerboard pattern. We can create it using repeating-conic-gradient with two colors. The first will be our --color variable, and the second could be transparent. But in this case, I think black with very low opacity works better.

We just need to set the background-size to control the pattern scale, and of course, make sure to apply background-clip: text here too:

.layer {
--n: calc(var(--i) / var(--layers-count));
--color: hsl(200 30% calc(var(--n) \* 100%));

color: transparent;
background-image:
repeating-conic-gradient(var(--color) 0 90deg, hsl(0 0% 0% / 5%) 0 180deg);
background-size: 0.2em 0.2em;
background-clip: text;
transform: translateZ(calc(var(--i) \* var(--layer-offset)));
animation: checkers 24s infinite linear;
}

@keyframes checkers {
to { background-position: 1em 0.4em; }
}
As you can see, I have already added the animation property. In this case, it is very simple to animate the pattern. Just slowly move the background-position, and that is it. Now we have text with a moving 3D pattern:

Variable Fonts
So far, we have been using a single font, and as I mentioned earlier, font choice is mostly a matter of taste or brand guidelines. But since we are already working with layered text, we absolutely have to try it with variable fonts. The idea behind variable fonts is that each one includes axes you can manipulate to change its appearance. These can include width, weight, slant, or just about anything else.

Here are a few examples I really like. The first one uses the Climate Crisis font, which has a YEAR axis that ranges from 1979 to 2025. With each year, the letters melt slightly and shrink a bit. It is a powerful ecological statement, and when you stack the text in layers, you can actually see the changes and get a pretty striking 3D effect:

Another great option is Bitcount, a variable font with a classic weight axis ranging from 100 to 900. By changing the weight based on the layer index, you get a layered effect that looks like peaks rising across the text:

And here is an example that might give your browser a bit of a workout. The font Kablammo includes a MORF axis, and adjusting it completely changes the shape of each letter. So, I figured it would be fun to animate that axis (yes, font-variation-settings is animatable), and add a short delay between the layers, like we saw earlier, to give the animation a more dynamic and lively feel.

Delayed Position
Before we wrap up this second chapter, I want to show you one more animation. By now you have probably noticed that there is always more than one way to do things, and sometimes it is just a matter of finding the right approach. Even the positioning of the layers, which we have been handling statically with translateZ, can be done a little differently.

If we animate the layers to move along the z-axis, from zero to the full height of the text, and add an equal delay between each one, we end up with the same visual 3D effect, only in motion.

.layer {
--n: calc(var(--i) / var(--layers-count));
--delay: calc(var(--n) \* -3s);

animation: layer 3s var(--delay) infinite ease-in-out;
}

@keyframes layer {
from { transform: translateZ(0); }
to { transform: translateZ(calc(var(--layers-count) \* var(--layer-offset))); }
}
This is a more advanced technique, suited for more complex animations. It is not something you need for every use case, but for certain effects, it can look very cool.

Wrapping Up
So far, we have brought the layered text effect to life with movement, variation, and creative styling. We also saw how even small changes can have a huge visual impact when applied across layers.

But everything we have done so far has been pre defined and self contained. In the next chapter, we are going to add a layer of interactivity. Literally. From simple :hover transitions to using JavaScript to track the mouse position, we will apply real-time transformations and build a fully responsive bulging effect.

Source:

https://css-tricks.com/3d-layered-text-motion-and-variations/

example:

HTML CSSResult Skip Results Iframe
EDIT ON

<div class="scene">
  <div class="layeredText">
    <span>Floating</span>
    <div class="layers" aria-hidden="true">
      <div class="layer" style="--i: 1;">Floating</div>
      <div class="layer" style="--i: 2;">Floating</div>
      <div class="layer" style="--i: 3;">Floating</div>
      <div class="layer" style="--i: 4;">Floating</div>
      <div class="layer" style="--i: 5;">Floating</div>
      <div class="layer" style="--i: 6;">Floating</div>
      <div class="layer" style="--i: 7;">Floating</div>
      <div class="layer" style="--i: 8;">Floating</div>
      <div class="layer" style="--i: 9;">Floating</div>
      <div class="layer" style="--i: 10;">Floating</div>
      <div class="layer" style="--i: 11;">Floating</div>
      <div class="layer" style="--i: 12;">Floating</div>
      <div class="layer" style="--i: 13;">Floating</div>
      <div class="layer" style="--i: 14;">Floating</div>
      <div class="layer" style="--i: 15;">Floating</div>
      <div class="layer" style="--i: 16;">Floating</div>
      <div class="layer" style="--i: 17;">Floating</div>
      <div class="layer" style="--i: 18;">Floating</div>
      <div class="layer" style="--i: 19;">Floating</div>
      <div class="layer" style="--i: 20;">Floating</div>
      <div class="layer" style="--i: 21;">Floating</div>
      <div class="layer" style="--i: 22;">Floating</div>
      <div class="layer" style="--i: 23;">Floating</div>
      <div class="layer" style="--i: 24;">Floating</div>
    </div>
  </div>
</div>

Resources1× 0.5× 0.25×Rerun

HTML CSSResult Skip Results Iframe
EDIT ON
@import url("https://fonts.googleapis.com/css?family=Montserrat:900");

_, _::before, \*::after {
padding: 0;
margin: 0;
box-sizing: border-box;
}

body {
background-color: #555;
color: #fff;
min-height: 100vh;
display: grid;
place-items: center;
text-align: center;
font-size: 100px;
overflow: clip;
}

.scene {
perspective: 400px;

- {
  transform-style: preserve-3d;
  }
  }

.layeredText {
--layers-count: 24;
--layer-offset: 1px;

position: relative;
font-family: Montserrat, sans-serif;
font-weight: 900;
animation: wobble 27s infinite linear;

span {
color: transparent;
animation: shadow 2s infinite ease-in-out alternate;
}

.layers, .layer {
position: absolute;
inset: 0;
}

.layers {
animation: hover 2s infinite ease-in-out alternate;
}

.layer {
--n: calc(var(--i) / var(--layers-count));

    transform: translateZ(calc(var(--i) * var(--layer-offset)));
    color: hsl(200 30% calc(var(--n) * 80% + 20%));

}
}

@keyframes wobble {
from { transform: rotate(0deg) rotateX(30deg) rotate(360deg); }
to { transform: rotate(360deg) rotateX(30deg) rotate(0deg); }
}

@keyframes hover {
from { transform: translateZ(0.3em); }
to { transform: translateZ(0.6em); }
}

@keyframes shadow {
from { text-shadow: 0 0 0.1em #000; }
to { text-shadow: 0 0 0.2em #000; }
}

Resources1× 0.5× 0.25×Rerun
